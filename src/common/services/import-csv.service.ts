import { Injectable } from '@nestjs/common';
import { parse } from 'csv-parse/sync';

@Injectable()
export class ImportCsvService {
  constructor() {}

  async importCsv(
    file: Express.Multer.File,
    requiredColumns: string[],
  ) {
    try {
      if (!file) {
        return {
          error: true,
          message: 'No se recibió ningún archivo',
          data: null,
        };
      }

      if (
        !file.originalname
          .toLowerCase()
          .endsWith('.csv')
      ) {
        return {
          error: true,
          message: 'El archivo debe ser un CSV',
          data: null,
        };
      }

      const csvContent =
        file.buffer.toString('utf-8');

      const records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });

      const csvColumns =
        records.length > 0
          ? Object.keys(records[0])
          : [];

      const missingColumns =
        requiredColumns.filter(
          (column) =>
            !csvColumns.includes(column),
        );

      if (missingColumns.length > 0) {
        return {
          error: true,
          message: `El archivo CSV no contiene las siguientes columnas requeridas: ${missingColumns.join(', ')}`,
          data: null,
        };
      }

      return {
        error: false,
        message:
          'Archivo CSV convertido correctamente',
        data: records,
      };

    } catch (error) {
      return {
        error: true,
        message:
          'Error al procesar el archivo CSV',
        data: null,
      };
    }
  }
}