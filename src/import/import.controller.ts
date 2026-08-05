import { Controller, Post, Req, Param, BadRequestException, Query } from '@nestjs/common';
import multer from 'multer';
import { ApiConsumes, ApiBody, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ImportGatewayService } from './import.service';
import { FtpService } from 'src/common';
import { ftpStorage } from 'src/common/import/ftp-storage';
import { Request } from 'express';

@Controller('import')
export class ImportController {
  constructor(
    private readonly importGatewayService: ImportGatewayService,
    private readonly ftpService: FtpService,
  ) {}

  @Post(':name')
  @ApiOperation({ summary: 'Importar archivo CSV o Excel' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Archivo a importar',
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiQuery({ name: 'userId', required: false, description: 'Usuario que realiza la importación' })
  async uploadFile(
    @Req() req: Request,
    @Param('name') name: string,
    @Query('userId') userId?: string,
  ) {
    await new Promise<void>((resolve, reject) => {
      multer({
        storage: ftpStorage(this.ftpService, name),
        limits: { fileSize: 100 * 1024 * 1024 },
      }).single('file')(req, {} as any, (err: any) => {
        if (err) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            reject(new BadRequestException('El archivo excede el tamaño máximo permitido (100MB)'));
          } else {
            reject(new BadRequestException(err.message));
          }
        } else {
          resolve();
        }
      });
    });

    const file = (req as any).file;
    if (!file) throw new BadRequestException('Archivo requerido');

    return this.importGatewayService.processAndSendInBatches(file, name, userId);
  }
}
