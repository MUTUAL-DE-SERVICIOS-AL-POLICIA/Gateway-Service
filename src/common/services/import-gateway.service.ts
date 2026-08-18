import { Injectable, Logger, BadRequestException, HttpException } from '@nestjs/common';
import csv from 'csv-parser';
import * as XLSX from 'xlsx';
import * as ExcelJS from 'exceljs';
import { FtpService } from './ftp.service';
import { NatsService } from './nats.service';

const XLS_MAX_SIZE = 500 * 1024;

interface ImportConfig {
  name: string;
  microservice: string;
  schema: string;
  table: string;
  skipRows: number;
  startColumn: number;
  delimiter: string;
  columnMappings: { columnIndex: number; fieldName: string }[];
}

@Injectable()
export class ImportGatewayService {
  private readonly logger = new Logger('ImportGatewayService');
  private readonly BATCH_SIZE = 1000;
  private readonly importChains = new Map<string, Promise<any>>();

  constructor(
    private readonly ftpService: FtpService,
    private readonly natsService: NatsService,
  ) {}

  async processFile(file: Express.Multer.File & { ftpPath?: string; fileHash?: string }, name: string, userId?: string) {
    return this.runSequentially(name, () => this.processFileInternal(file, name, userId));
  }

  private async runSequentially(configName: string, fn: () => Promise<any>): Promise<any> {
    const previous = this.importChains.get(configName) || Promise.resolve();
    const next = previous.then(() => fn(), () => fn());
    this.importChains.set(configName, next);
    try {
      return await next;
    } finally {
      if (this.importChains.get(configName) === next) {
        this.importChains.delete(configName);
      }
    }
  }

  private async processFileInternal(file: Express.Multer.File & { ftpPath?: string; fileHash?: string }, name: string, userId?: string) {
    const ftpPath = file.ftpPath;
    if (!ftpPath) {
      this.logger.warn('FTP upload skipped or failed. Continuing without FTP backup.');
    }

    const { config, record } = await this.natsService.firstValue('global.initImport', {
      name,
      ftpPath,
      originalFileName: file.originalname,
      fileHash: file.fileHash,
      uploadedBy: userId || 'anónimo',
    });

    // Obtener MAX(id) actual antes de importar para reportar rango correcto
    try {
      const maxIdResponse = await this.natsService.firstValue(
        `${config.microservice}.getMaxId`,
        { tableName: config.table, schema: config.schema },
      );
      const currentMaxId = maxIdResponse?.maxId || 0;
      this.logger.log(`MAX(id) actual en ${config.schema}.${config.table}: ${currentMaxId}, importación empezará desde ${currentMaxId + 1}`);
    } catch (error: any) {
      this.logger.warn(`No se pudo obtener MAX(id) para ${config.table}: ${error?.message || error}. Se usarán los IDs retornados por RETURNING id.`);
    }

    try {
      const originalName = file.originalname?.toLowerCase() || '';
      let result: { totalSent: number; rowStart: number; rowEnd: number };

      if (originalName.endsWith('.csv')) {
        result = await this.processCSVFromFtp(ftpPath, config, record.id);
      } else if (originalName.endsWith('.xlsx')) {
        result = await this.processXLSXStream(ftpPath, config, record.id);
      } else if (originalName.endsWith('.xls')) {
        result = await this.processXLSBuffer(ftpPath, config, record.id, file.size || 0);
      } else {
        throw new BadRequestException('Formato de archivo no soportado. Use CSV o Excel (.xlsx)');
      }

      await this.natsService.firstValue('global.finalizeImport', {
        id: record.id,
        status: 'COMPLETED',
        rowStart: result.rowStart,
        rowEnd: result.rowEnd,
        totalRows: result.totalSent,
      });

      this.logger.log(`Importación completada: ${config.name}, IDs reales ${result.rowStart}-${result.rowEnd}, archivo: ${ftpPath}`);

      return {
        recordId: record.id,
        configName: config.name,
        rowStart: result.rowStart,
        rowEnd: result.rowEnd,
        totalRows: result.totalSent,
        ftpPath,
        message: `Importación ${config.name} completada. IDs ${result.rowStart} a ${result.rowEnd} (${result.totalSent} registros).`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';

      let rollbackStatus = 'ROLLBACK_SUCCESS';
      try {
        const rollbackPattern = `${config.microservice}.rollbackImport`;
        await this.natsService.firstValue(rollbackPattern, { importId: record.id });
      } catch (rollbackError) {
        rollbackStatus = 'ROLLBACK_FAILED';
        this.logger.error(`Error al hacer rollback en ${config.name}: ${rollbackError}`);
      }

      await this.natsService.firstValue('global.finalizeImport', {
        id: record.id,
        status: 'FAILED',
        errorMessage: `${errorMessage} [${rollbackStatus}]`,
      });

      this.logger.error(`Error en importación ${config.name}: ${errorMessage}`, error instanceof Error ? error.stack : '');
      throw error;
    }
  }

  private async processCSVFromFtp(ftpPath: string, config: ImportConfig, importId: number): Promise<{
    totalSent: number;
    rowStart: number;
    rowEnd: number;
  }> {
    const ftpStream = await this.ftpService.downloadToPassThrough(ftpPath);
    const batchSize = this.BATCH_SIZE;
    let batch: any[] = [];
    let totalSent = 0;
    let firstId: number | null = null;
    let lastId: number | null = null;

    return new Promise<{ totalSent: number; rowStart: number; rowEnd: number }>((resolve, reject) => {
      const csvStream = ftpStream.pipe(csv({
        headers: false,
        skipLines: config.skipRows,
        separator: config.delimiter || ',',
      }));

      csvStream.on('data', async (row: Record<string, string>) => {
        const values: string[] = Object.keys(row)
          .sort((a, b) => Number(a) - Number(b))
          .map(key => row[key]);

        const mappedRow = this.mapRowByConfig(values, config);

        if (mappedRow && Object.keys(mappedRow).length > 0) {
          batch.push(mappedRow);
        }

        if (batch.length >= batchSize) {
          csvStream.pause();
          const currentBatch = [...batch];
          batch = [];

          try {
            const response = await this.sendBatch(config, currentBatch, false, importId);
            totalSent += currentBatch.length;

            if (response.idStart != null && firstId === null) firstId = response.idStart;
            if (response.idEnd != null) lastId = response.idEnd;

            csvStream.resume();
          } catch (error) {
            reject(error);
          }
        }
      });

      csvStream.on('end', async () => {
        try {
          if (batch.length > 0) {
            const response = await this.sendBatch(config, batch, true, importId);
            totalSent += batch.length;
            if (response.idStart != null && firstId === null) firstId = response.idStart;
            if (response.idEnd != null) lastId = response.idEnd;
          } else {
            await this.sendBatch(config, [], true, importId);
          }

          resolve({
            totalSent,
            rowStart: firstId ?? 0,
            rowEnd: lastId ?? 0,
          });
        } catch (error) {
          reject(error);
        }
      });

      csvStream.on('error', (error) => reject(error));
    });
  }

  private async processXLSXStream(ftpPath: string, config: ImportConfig, importId: number): Promise<{
    totalSent: number;
    rowStart: number;
    rowEnd: number;
  }> {
    const ftpStream = await this.ftpService.downloadToPassThrough(ftpPath);

    const reader = new ExcelJS.stream.xlsx.WorkbookReader(ftpStream, {
      sharedStrings: 'cache',
      styles: 'ignore',
      hyperlinks: 'ignore',
    });

    let totalSent = 0;
    let firstId: number | null = null;
    let lastId: number | null = null;

    for await (const worksheet of reader) {
      let rowIndex = 0;
      let batch: any[] = [];

      for await (const row of worksheet) {
        rowIndex++;

        if (rowIndex <= config.skipRows) {
          continue;
        }

        const rawValues: any[] = (row.values as any[]) || [];
        const values: any[] = rawValues.slice(1);

        const mappedRow = this.mapRowByConfig(values, config);

        if (mappedRow && Object.keys(mappedRow).length > 0) {
          batch.push(mappedRow);
        }

        if (batch.length >= this.BATCH_SIZE) {
          const response = await this.sendBatch(config, [...batch], false, importId);
          totalSent += batch.length;
          batch = [];

          if (response.idStart != null && firstId === null) firstId = response.idStart;
          if (response.idEnd != null) lastId = response.idEnd;
        }
      }

      if (batch.length > 0) {
        const response = await this.sendBatch(config, batch, false, importId);
        totalSent += batch.length;
        if (response.idStart != null && firstId === null) firstId = response.idStart;
        if (response.idEnd != null) lastId = response.idEnd;
      }
    }

    await this.sendBatch(config, [], true, importId);

    return {
      totalSent,
      rowStart: firstId ?? 0,
      rowEnd: lastId ?? 0,
    };
  }

  private async processXLSBuffer(ftpPath: string, config: ImportConfig, importId: number, fileSize: number): Promise<{
    totalSent: number;
    rowStart: number;
    rowEnd: number;
  }> {
    if (fileSize > XLS_MAX_SIZE) {
      throw new BadRequestException(
        `Archivo .xls demasiado grande (${(fileSize / 1024).toFixed(0)}KB). ` +
        `El límite es ${XLS_MAX_SIZE / 1024}KB porque el formato .xls requiere cargarse ` +
        'completamente en memoria. Conviértalo a .xlsx (Excel 2007+) para procesar archivos grandes.'
      );
    }

    const buffer = await this.ftpService.downloadBuffer(ftpPath);

    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      range: config.skipRows,
      defval: '',
    });

    let batch: any[] = [];
    let totalSent = 0;
    let firstId: number | null = null;
    let lastId: number | null = null;

    for (const values of rows) {
      const mappedRow = this.mapRowByConfig(values, config);

      if (mappedRow && Object.keys(mappedRow).length > 0) {
        batch.push(mappedRow);
      }

      if (batch.length >= this.BATCH_SIZE) {
        const currentBatch = [...batch];
        batch = [];

        const response = await this.sendBatch(config, currentBatch, false, importId);
        totalSent += currentBatch.length;

        if (response.idStart != null && firstId === null) firstId = response.idStart;
        if (response.idEnd != null) lastId = response.idEnd;
      }
    }

    if (batch.length > 0) {
      const response = await this.sendBatch(config, batch, true, importId);
      totalSent += batch.length;
      if (response.idStart != null && firstId === null) firstId = response.idStart;
      if (response.idEnd != null) lastId = response.idEnd;
    } else {
      await this.sendBatch(config, [], true, importId);
    }

    return {
      totalSent,
      rowStart: firstId ?? 0,
      rowEnd: lastId ?? 0,
    };
  }

  private mapRowByConfig(values: any[], config: ImportConfig): Record<string, any> {
    const mappings = config.columnMappings;
    if (!mappings || mappings.length === 0) {
      return values;
    }

    const startIdx = (config.startColumn || 1) - 1;
    const slicedValues = startIdx > 0 ? values.slice(startIdx) : values;

    const result: Record<string, any> = {};

    for (const mapping of mappings) {
      const index = mapping.columnIndex - 1;

      if (index >= 0 && index < slicedValues.length) {
        const value = slicedValues[index];
        if (value !== null && value !== undefined && value !== '') {
          result[mapping.fieldName] = value;
        }
      }
    }

    return result;
  }

  private async sendBatch(config: ImportConfig, data: any[], isLastBatch: boolean, importId: number): Promise<{
    processed: number;
    isLastBatch: boolean;
    idStart: number | null;
    idEnd: number | null;
  }> {
    const targetPattern = `${config.microservice}.${config.table}.importBatch`;
    const payload = {
      data,
      isLastBatch,
      importId,
    };

    try {
      const response = await this.natsService.firstValue(targetPattern, payload);
      return response;
    } catch (error) {
      // Retry once on transient errors (503)
      const isTransient = error instanceof HttpException && error.getStatus() === 503;

      if (isTransient && !isLastBatch) {
        this.logger.warn(`Retrying batch to ${targetPattern} after transient error: ${error.message}`);
        await this.delay(1000);
        const response = await this.natsService.firstValue(targetPattern, payload);
        return response;
      }

      throw error;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
