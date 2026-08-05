import { Seeder } from 'typeorm-extension';
import { DataSource } from 'typeorm';
import { ImportConfig } from 'src/common/import/entities/import-config.entity';

/**
 * @deprecated Este seed está obsoleto. Usa la API REST para crear configs:
 *   POST http://localhost:3000/api/import/configs
 *   Body: { "name": "extractos_bancarios", "microservice": "collections", ... }
 *
 * Ver MANUAL-IMPORTACION.md sección 6 para más detalles.
 *
 * Seed para la configuración inicial de importación de extractos bancarios.
 * Usa upsert (conflict on name → update), así que se puede ejecutar
 * múltiples veces sin duplicar registros.
 *
 * El name "extractos_bancarios" se usa en la URL: POST /import/extractos_bancarios
 */
export default class ImportConfigSeed implements Seeder {
  async run(dataSource: DataSource): Promise<void> {
    const repo = dataSource.getRepository(ImportConfig);

    const config = {
      name: 'extractos_bancarios',
      microservice: 'collections',
      schema: 'collections',
      table: 'bank_statements',
      skipRows: 2,
      startColumn: 2,
      delimiter: ',',
      columnMappings: [
        { columnIndex: 2, fieldName: 'date' },
        { columnIndex: 5, fieldName: 'operationCode' },
        { columnIndex: 6, fieldName: 'documentNumber' },
        { columnIndex: 7, fieldName: 'gloss' },
        { columnIndex: 8, fieldName: 'transferredAccount' },
        { columnIndex: 11, fieldName: 'credits' },
        { columnIndex: 14, fieldName: 'state' },
      ],
      isActive: true,
    };

    // upsert: si existe con ese name, actualiza; si no, inserta.
    // Se puede ejecutar mil veces y siempre habrá 1 solo registro.
    await repo.upsert(config, ['name']);

    console.log('Configuración extractos_bancarios creada/actualizada correctamente.');
  }
}
