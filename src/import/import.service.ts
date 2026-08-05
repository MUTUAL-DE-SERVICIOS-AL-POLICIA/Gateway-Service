import { Injectable, Logger } from '@nestjs/common';
import { ImportService } from 'src/common';

/**
 * Servicio de importación del Gateway.
 * Ahora delega toda la lógica al ImportService de common,
 * que maneja: subida a FTP, registro en BD, parsing y envío NATS.
 */
@Injectable()
export class ImportGatewayService {
  private readonly logger = new Logger('ImportGatewayService');

  constructor(private readonly importService: ImportService) {}

  /**
   * Procesa un archivo de importación usando el servicio centralizado.
   * @param file Archivo subido (CSV/Excel)
   * @param name Nombre único de la configuración de importación (ej: "extractos_bancarios")
   * @param userId Usuario que realiza la importación (opcional)
   */
  async processAndSendInBatches(file: Express.Multer.File, name: string, userId?: string) {
    return this.importService.processFile(file, name, userId);
  }
}