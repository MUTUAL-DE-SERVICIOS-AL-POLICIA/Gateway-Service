import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import csv from 'csv-parser';
import * as XLSX from 'xlsx';
import * as ExcelJS from 'exceljs';
import { ImportConfig } from './entities/import-config.entity';
import { ImportRecord, ImportStatus } from './entities/import-record.entity';
import { FtpService } from '../services/ftp.service';
import { NatsService } from '../services/nats.service';

// Límite para archivos .xls (formato binario antiguo). SheetJS necesita
// cargar el archivo completo en RAM, por lo que limitamos a 500KB
// para no exceder el ~1MB de memoria disponible en el Gateway.
const XLS_MAX_SIZE = 500 * 1024;

@Injectable()
export class ImportGatewayService {
  private readonly logger = new Logger('ImportService');
  private readonly BATCH_SIZE = 500;

  /**
   * Cadena de promesas por nombre de config.
   * Garantiza que dos importaciones con la misma config
   * NO se ejecuten en paralelo: una espera a que la otra termine.
   *
   * Map<configName, Promise> donde cada nueva import se encadena
   * a la anterior con .then(). Si la anterior falla, la siguiente
   * igual se ejecuta (no se bloquea permanentemente).
   */
  private readonly importChains = new Map<string, Promise<any>>();

  constructor(
    @InjectRepository(ImportConfig)
    private readonly configRepo: Repository<ImportConfig>,
    @InjectRepository(ImportRecord)
    private readonly recordRepo: Repository<ImportRecord>,
    private readonly ftpService: FtpService,
    private readonly natsService: NatsService,
  ) {}

  async processFile(file: Express.Multer.File & { ftpPath?: string; fileHash?: string }, name: string, userId?: string) {
    return this.runSequentially(name, () => this.processFileInternal(file, name, userId));
  }

  /**
   * Ejecuta una función solo después de que la importación anterior
   * con el mismo configName haya terminado (éxito o error).
   * Limpia el Map después de resolver para evitar memory leaks.
   */
  private async runSequentially(configName: string, fn: () => Promise<any>): Promise<any> {
    const previous = this.importChains.get(configName) || Promise.resolve();
    const next = previous.then(() => fn(), () => fn());
    this.importChains.set(configName, next);
    try {
      return await next;
    } finally {
      // Limpiar solo si somos la cadena actual (no fue reemplazado por otra import)
      if (this.importChains.get(configName) === next) {
        this.importChains.delete(configName);
      }
    }
  }

  private async processFileInternal(file: Express.Multer.File & { ftpPath?: string; fileHash?: string }, name: string, userId?: string) {
    const ftpPath = file.ftpPath;
    if (!ftpPath) {
      throw new Error('El archivo no fue subido al FTP correctamente');
    }

    const config = await this.getConfig(name);

    // ── Chequeo de duplicados por hash ──────────────────────────
    if (file.fileHash) {
      const existing = await this.recordRepo.findOne({
        where: {
          target: config.name,
          fileHash: file.fileHash,
          status: ImportStatus.COMPLETED,
        },
      });
      if (existing) {
        throw new BadRequestException(
          `El archivo "${file.originalname}" ya fue importado correctamente el ${existing.createdAt?.toISOString().split('T')[0] || 'fecha desconocida'}.`
          + ' Si necesita reimportarlo, elimine el registro primero.',
        );
      }
    }

    const rowStart = await this.calcularRowStart(config);

    const record = this.recordRepo.create({
      target: config.name,
      ftpPath,
      originalFileName: file.originalname,
      fileHash: file.fileHash || null,
      uploadedBy: userId || 'anónimo',
      rowStart,
      status: ImportStatus.PENDING,
    });
    await this.recordRepo.save(record);

    try {
      record.status = ImportStatus.PROCESSING;
      await this.recordRepo.save(record);

      const originalName = file.originalname?.toLowerCase() || '';

      let result: { totalSent: number; rowStart: number; rowEnd: number };

      if (originalName.endsWith('.csv')) {
        result = await this.processCSVFromFtp(ftpPath, config, record);
      } else if (originalName.endsWith('.xlsx')) {
        // .xlsx se procesa en streaming con exceljs, sin límite de tamaño
        result = await this.processXLSXStream(ftpPath, config, record);
      } else if (originalName.endsWith('.xls')) {
        // .xls (formato binario antiguo) — exceljs NO lo soporta en streaming.
        // Usamos SheetJS con límite de 500KB porque necesita cargar completo en RAM.
        result = await this.processXLSBuffer(ftpPath, config, record, file.size || 0);
      } else {
        throw new BadRequestException('Formato de archivo no soportado. Use CSV o Excel (.xlsx)');
      }

      // Usar los IDs reales devueltos por el microservicio destino
      record.rowStart = result.rowStart;
      record.rowEnd = result.rowEnd;
      record.totalRows = result.totalSent;
      record.processedRows = result.totalSent;
      record.status = ImportStatus.COMPLETED;
      await this.recordRepo.save(record);

      this.logger.log(`Importación completada: ${config.name}, IDs reales ${record.rowStart}-${record.rowEnd}, archivo: ${ftpPath}`);

      return {
        recordId: record.id,
        configName: config.name,
        rowStart: record.rowStart,
        rowEnd: record.rowEnd,
        totalRows: result.totalSent,
        ftpPath,
        message: `Importación ${config.name} completada. IDs ${record.rowStart} a ${record.rowEnd} (${result.totalSent} registros).`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';

      // Notificar al microservicio destino que elimine los datos ya insertados
      // (envío directo sin pasar por Global)
      try {
        const rollbackPattern = `${config.microservice}.rollbackImport`;
        await this.natsService.firstValue(rollbackPattern, { importId: record.id });
      } catch (rollbackError) {
        this.logger.error(`Error al hacer rollback en ${config.name}: ${rollbackError}`);
      }

      // Resetear rowStart/rowEnd a 0 (no hay datos en la tabla destino)
      record.rowStart = 0;
      record.rowEnd = 0;
      record.status = ImportStatus.FAILED;
      record.errorMessage = errorMessage;
      await this.recordRepo.save(record);

      this.logger.error(`Error en importación ${config.name}: ${errorMessage}`, error instanceof Error ? error.stack : '');
      throw error;
    }
  }

  private async processCSVFromFtp(ftpPath: string, config: ImportConfig, record: ImportRecord): Promise<{
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
            const response = await this.sendBatch(config, currentBatch, false, record.id);
            totalSent += currentBatch.length;

            // Capturar IDs reales de la BD destino
            if (response.idStart != null && firstId === null) firstId = response.idStart;
            if (response.idEnd != null) lastId = response.idEnd;

            record.processedRows = totalSent;
            await this.recordRepo.save(record);

            csvStream.resume();
          } catch (error) {
            reject(error);
          }
        }
      });

      csvStream.on('end', async () => {
        try {
          if (batch.length > 0) {
            const response = await this.sendBatch(config, batch, true, record.id);
            totalSent += batch.length;
            if (response.idStart != null && firstId === null) firstId = response.idStart;
            if (response.idEnd != null) lastId = response.idEnd;
          } else {
            await this.sendBatch(config, [], true, record.id);
          }

          record.processedRows = totalSent;
          await this.recordRepo.save(record);
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

  /**
   * Procesa .xlsx en streaming con exceljs, fila por fila, sin cargar
   * el archivo completo en RAM. Soporta archivos de cualquier tamaño
   * porque la memoria usada es O(1): solo se retienen las filas del
   * lote actual (~500 filas) en un buffer circular.
   *
   * Cómo funciona el streaming:
   * - exceljs.WorkbookReader desempaqueta el ZIP internamente
   *   y emite hojas de cálculo una por una.
   * - WorksheetReader expone un async iterator que cede filas
   *   individuales (Row). Cada Row.values es un array 1-indexado
   *   donde la posición 1 = columna A, 2 = columna B, etc.
   * - El for await se pausa naturalmente cuando hacemos "await"
   *   dentro del cuerpo (ej: sendBatch). Esto frena la lectura
   *   del ZIP y, por backpressure, la descarga del FTP.
   */
  private async processXLSXStream(ftpPath: string, config: ImportConfig, record: ImportRecord): Promise<{
    totalSent: number;
    rowStart: number;
    rowEnd: number;
  }> {
    // Obtener un stream de lectura desde el archivo en FTP
    const ftpStream = await this.ftpService.downloadToPassThrough(ftpPath);

    // WorkbookReader lee el .xlsx en streaming (ZIP + XML SAX)
    const reader = new ExcelJS.stream.xlsx.WorkbookReader(ftpStream, {
      sharedStrings: 'cache',  // Necesario para resolver strings compartidos
      styles: 'ignore',        // No necesitamos formato de celdas
      hyperlinks: 'ignore',    // No necesitamos hipervínculos
    });

    let totalSent = 0;
    let firstId: number | null = null;
    let lastId: number | null = null;

    // Iterar sobre cada hoja del libro
    for await (const worksheet of reader) {
      let rowIndex = 0;
      let batch: any[] = [];

      // Iterar sobre cada fila de la hoja en streaming
      for await (const row of worksheet) {
        rowIndex++;

        // Saltar filas de encabezado según la configuración (skipRows)
        if (rowIndex <= config.skipRows) {
          continue;
        }

        // exceljs usa arrays 1-indexados: values[1]=col A, values[2]=col B, etc.
        // Convertimos a 0-indexado quitando el primer elemento (undefined)
        const rawValues: any[] = (row.values as any[]) || [];
        const values: any[] = rawValues.slice(1);

        // Aplicar el mapeo de columnas definido en import_configs
        const mappedRow = this.mapRowByConfig(values, config);

        if (mappedRow && Object.keys(mappedRow).length > 0) {
          batch.push(mappedRow);
        }

        // Cuando el lote está lleno, enviar y continuar
        if (batch.length >= this.BATCH_SIZE) {
          const response = await this.sendBatch(config, [...batch], false, record.id);
          totalSent += batch.length;
          batch = [];

          // Capturar IDs reales de la BD destino
          if (response.idStart != null && firstId === null) firstId = response.idStart;
          if (response.idEnd != null) lastId = response.idEnd;

          record.processedRows = totalSent;
          await this.recordRepo.save(record);

          // Nota: no necesitamos pause/resume explícito porque
          // el for await se detiene automáticamente durante el await.
          // exceljs respeta backpressure: mientras no llamemos a
          // next() del iterador, no avanza la lectura del ZIP.
        }
      }

      // Enviar el lote restante de esta hoja, PERO sin marcar como último lote
      // (isLastBatch=false) porque pueden venir más hojas después.
      // isLastBatch=true se envía al final, después de procesar TODAS las hojas.
      if (batch.length > 0) {
        const response = await this.sendBatch(config, batch, false, record.id);
        totalSent += batch.length;
        if (response.idStart != null && firstId === null) firstId = response.idStart;
        if (response.idEnd != null) lastId = response.idEnd;
      }

      record.processedRows = totalSent;
      await this.recordRepo.save(record);
    }

    // FINAL: marcar como último lote (isLastBatch=true) para que el
    // microservicio destino limpie el tracker y confirme la importación.
    await this.sendBatch(config, [], true, record.id);

    return {
      totalSent,
      rowStart: firstId ?? 0,
      rowEnd: lastId ?? 0,
    };
  }

  /**
   * Procesa .xls (formato binario antiguo) con SheetJS.
   * exceljs NO soporta .xls en streaming, así que caemos a SheetJS
   * que requiere el archivo completo en RAM. Limitamos a 500KB.
   */
  private async processXLSBuffer(ftpPath: string, config: ImportConfig, record: ImportRecord, fileSize: number): Promise<{
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

    // Descargar el archivo completo del FTP a un buffer
    const buffer = await this.ftpService.downloadBuffer(ftpPath);

    // Parsear con SheetJS (carga completa en RAM).
    // cellDates:true convierte los seriales numéricos de Excel (ej: 46097)
    // en objetos Date de JS, que JSON serializa como "2026-03-14T00:00:00.000Z"
    // y PostgreSQL acepta sin problema en columnas date.
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
      // SheetJS devuelve arrays 0-indexados (misma lógica que CSV)
      const mappedRow = this.mapRowByConfig(values, config);

      if (mappedRow && Object.keys(mappedRow).length > 0) {
        batch.push(mappedRow);
      }

      if (batch.length >= this.BATCH_SIZE) {
        const currentBatch = [...batch];
        batch = [];

        const response = await this.sendBatch(config, currentBatch, false, record.id);
        totalSent += currentBatch.length;

        // Capturar IDs reales de la BD destino
        if (response.idStart != null && firstId === null) firstId = response.idStart;
        if (response.idEnd != null) lastId = response.idEnd;

        record.processedRows = totalSent;
        await this.recordRepo.save(record);
      }
    }

    if (batch.length > 0) {
      const response = await this.sendBatch(config, batch, true, record.id);
      totalSent += batch.length;
      if (response.idStart != null && firstId === null) firstId = response.idStart;
      if (response.idEnd != null) lastId = response.idEnd;
    } else {
      await this.sendBatch(config, [], true, record.id);
    }

    record.processedRows = totalSent;
    await this.recordRepo.save(record);

    return {
      totalSent,
      rowStart: firstId ?? 0,
      rowEnd: lastId ?? 0,
    };
  }

  /**
   * Mapea una fila (array 0-indexado) a un objeto con los campos definidos
   * en la configuración de mapeo de columnas.
   *
   * Tanto CSV como SheetJS devuelven arrays 0-indexados,
   * así que la lógica es la misma para ambos formatos.
   *
   * @param values Array de valores de la fila (0-indexado)
   * @param config Configuración de importación
   * @returns Objeto mapeado solo con los campos configurados
   */
  private mapRowByConfig(values: any[], config: ImportConfig): Record<string, any> {
    const mappings = config.columnMappings;
    if (!mappings || mappings.length === 0) {
      return values;
    }

    // Aplicar startColumn: recortar las columnas iniciales del array
    // startColumn es 1-indexed: startColumn=3 significa que empiezan datos en columna C
    const startIdx = (config.startColumn || 1) - 1;
    const slicedValues = startIdx > 0 ? values.slice(startIdx) : values;

    const result: Record<string, any> = {};

    for (const mapping of mappings) {
      // columnIndex en la config es 1-indexed, convertir a 0-indexado
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

  /**
   * Envía un lote directamente al microservicio destino usando el patrón NATS
   * derivado de microservice + table.
   * Ejemplo: "collections.bank_statements.importBatch"
   *
   * La respuesta incluye los IDs reales asignados por la BD (idStart, idEnd)
   * que se usan para poblar rowStart/rowEnd en import_record.
   */
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

    const response = await this.natsService.firstValue(targetPattern, payload);
    this.logger.debug(`Lote enviado a ${targetPattern} para ${config.name}: ${data.length} filas, importId: ${importId}, último: ${isLastBatch}`);
    return response;
  }

  /**
   * Obtiene la configuración de importación por su nombre único.
   * Lanza excepción si no existe o está inactiva.
   */
  private async getConfig(name: string): Promise<ImportConfig> {
    const config = await this.configRepo.findOne({ where: { name, isActive: true } });

    if (!config) {
      throw new NotFoundException(
        `No existe configuración de importación para "${name}". ` +
        `Registre una en la tabla import_configs.`,
      );
    }

    return config;
  }

  /**
   * Obtiene el próximo rowStart consultando primero el MAX(id) real en la
   * tabla destino vía NATS ({microservice}.getMaxId), pasando tableName y schema.
   * Si el microservicio no responde, cae al último import_record COMPLETED
   * como fallback.
   *
   * NOTA: El patrón NATS se construye directamente sin pasar por Global.
   */
  private async calcularRowStart(config: ImportConfig): Promise<number> {
    try {
      const pattern = `${config.microservice}.getMaxId`;
      const response = await this.natsService.firstValue(pattern, {
        tableName: config.table,
        schema: config.schema,
      });
      if (response?.maxId != null) {
        return response.maxId + 1;
      }
    } catch {
      this.logger.warn(`No se pudo obtener maxId de "${config.name}", usando fallback import_record`);
    }

    // Fallback: último import status COMPLETED en import_record
    const ultimo = await this.recordRepo.findOne({
      where: { target: config.name, status: ImportStatus.COMPLETED },
      order: { createdAt: 'DESC' },
    });

    return ultimo ? ultimo.rowEnd + 1 : 1;
  }

  /**
   * Obtiene el historial de importaciones realizadas.
   */
  async getHistory(limit = 20, offset = 0) {
    const [records, total] = await this.recordRepo.findAndCount({
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });

    return { records, total };
  }

  /**
   * Obtiene un registro de importación por su ID.
   */
  async getRecord(id: number): Promise<ImportRecord> {
    const record = await this.recordRepo.findOne({ where: { id } });
    if (!record) {
      throw new NotFoundException(`Registro de importación ${id} no encontrado`);
    }
    return record;
  }
}
