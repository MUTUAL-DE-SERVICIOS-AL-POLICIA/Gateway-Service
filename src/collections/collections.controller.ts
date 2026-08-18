import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
  Req,
  UseGuards,
  Post,
} from '@nestjs/common';

import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
  ApiBody,
  ApiConsumes,
} from '@nestjs/swagger';

import multer from 'multer';
import { NatsService } from 'src/common';
import { AuthGuard } from 'src/auth/guards';
import { FtpService, ftpStorage } from 'src/common/services/ftp.service';
import { ImportGatewayService } from 'src/common/services/import-gateway.service';
import { Request } from 'express';

@ApiTags('collections')
@ApiBearerAuth('msp')
@UseGuards(AuthGuard)
@Controller('collections')
export class CollectionsController {
  constructor(
    private readonly nats: NatsService,
    private readonly ftp: FtpService,
    private readonly importGatewayService: ImportGatewayService,
  ) {}

  @Get('search/:value/:type')
  @ApiResponse({
    status: 200,
    description: 'Buscar un afiliado',
  })
  async searchPerson(@Param('value') value: string, @Param('type') type: string) {
    return this.nats.send('sales.searchPerson', { value, type });
  }

  @Get('findAll')
  @ApiResponse({
    status: 200,
    description: 'Obtener todas las transacciones',
  })
  async findAll() {
    return this.nats.send('collections.findAll', {});
  }

  @Post('import/:name')
  @ApiOperation({ summary: 'Importar archivo CSV o Excel a collections' })
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
  async importFile(
    @Req() req: Request,
    @Param('name') name: string,
    @Query('userId') userId?: string,
  ) {
    await new Promise<void>((resolve, reject) => {
      multer({
        storage: ftpStorage(this.ftp, name),
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

    return this.importGatewayService.processFile(file, name, userId);
  }
}
