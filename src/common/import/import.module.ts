import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ImportConfig } from './entities/import-config.entity';
import { ImportRecord } from './entities/import-record.entity';
import { ImportService } from './import.service';

/**
 * Módulo de importación reutilizable para CSV/Excel.
 *
 * Proporciona el servicio ImportService que cualquier controlador
 * puede usar para procesar archivos de importación con:
 * - Subida a FTP como respaldo
 * - Registro en BD (quién, cuándo, estado)
 * - Mapeo flexible de columnas
 * - Envío por lotes vía NATS al microservicio destino
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([ImportConfig, ImportRecord]),
  ],
  providers: [ImportService],
  exports: [ImportService, TypeOrmModule],
})
export class ImportModule {}
