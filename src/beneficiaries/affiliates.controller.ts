import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Patch,
  Get,
  Param,
  Post,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Response } from 'express';
import { AuthGuard } from 'src/auth/guards/auth.guard';
import { FtpService, NatsService } from 'src/common';
import { Records } from 'src/records/records.interceptor';

@ApiTags('beneficiaries')
@UseGuards(AuthGuard)
@UseInterceptors(Records)
@Controller('beneficiaries/affiliates')
export class AffiliatesController {
  constructor(
    private readonly nats: NatsService,
    private readonly ftp: FtpService,
  ) {}

  @Get('createFileDossier/:affiliateId')
  @ApiResponse({ status: 200, description: 'Obtener todos los tipos de expedients' })
  async createFileDossier(@Param('affiliateId') affiliateId: string) {
    return this.nats.send('affiliate.createFileDossier', { affiliateId });
  }

  @Get('createDocument/:affiliateId')
  @ApiResponse({
    status: 200,
    description: 'Obtener todos los datos para crear documento del afiliado',
  })
  async createDocument(@Param('affiliateId') affiliateId: string) {
    return this.nats.send('affiliate.createDocument', { affiliateId });
  }

  @Get(':affiliateId')
  @ApiResponse({ status: 200, description: 'Mostrar datos del afiliado' })
  async findOneData(@Param('affiliateId') affiliateId: string) {
    return this.nats.send('affiliate.findOneData', { affiliateId });
  }

  @Post(':affiliateId/document/:procedureDocumentId')
  @ApiOperation({ summary: 'Enlazar y Subir Documento del Afiliado' })
  @ApiResponse({ status: 200, description: 'El documento fue subido exitosamente.' })
  @ApiResponse({
    status: 400,
    description: 'El archivo PDF es obligatorio o el archivo no es válido.',
  })
  @ApiResponse({ status: 500, description: 'Error interno del servidor.' })
  @ApiParam({ name: 'affiliateId', description: 'ID del afiliado', type: Number, example: 123 })
  @ApiParam({
    name: 'procedureDocumentId',
    description: 'ID del del documento',
    example: 456,
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Archivo PDF del documento del afiliado',
    type: 'multipart/form-data',
    required: true,
    schema: {
      type: 'object',
      properties: {
        documentPdf: {
          type: 'string',
          format: 'binary',
          description: 'Archivo PDF a subir',
        },
      },
    },
  })
  @UseInterceptors(AnyFilesInterceptor())
  async createAffiliateDocument(
    @Param('affiliateId') affiliateId: string,
    @Param('procedureDocumentId') procedureDocumentId: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('Debe subir al menos un archivo PDF');
    }

    files.forEach((file) => {
      if (file.mimetype !== 'application/pdf') {
        throw new BadRequestException('Todos los archivos deben ser PDF');
      }
    });

    const { error, message, affiliateDocuments } = await this.nats.firstValue(
      'affiliate.createAffiliateDocument',
      {
        affiliateId,
        procedureDocumentId,
      },
    );

    if (!error) {
      await this.ftp.uploadFile(files, affiliateDocuments);
    }

    return {
      error,
      message,
    };
  }

  @Patch(':affiliateId/document/:procedureDocumentId')
  @ApiOperation({ summary: 'Actualizar Documento del Afiliado' })
  @ApiResponse({ status: 200, description: 'El documento fue actualizado exitosamente.' })
  @ApiResponse({
    status: 400,
    description: 'El archivo PDF es obligatorio o el archivo no es válido.',
  })
  @ApiResponse({ status: 500, description: 'Error interno del servidor.' })
  @ApiParam({ name: 'affiliateId', description: 'ID del afiliado', type: Number, example: 123 })
  @ApiParam({
    name: 'procedureDocumentId',
    description: 'ID del del documento',
    example: 456,
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Archivo PDF del documento del afiliado',
    type: 'multipart/form-data',
    required: true,
    schema: {
      type: 'object',
      properties: {
        documentPdf: {
          type: 'string',
          format: 'binary',
          description: 'Archivo PDF a subir',
        },
      },
    },
  })
  @UseInterceptors(AnyFilesInterceptor())
  async updateAffiliateDocument(
    @Param('affiliateId') affiliateId: string,
    @Param('procedureDocumentId') procedureDocumentId: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('Debe subir al menos un archivo PDF');
    }

    files.forEach((file) => {
      if (file.mimetype !== 'application/pdf') {
        throw new BadRequestException('Todos los archivos deben ser PDF');
      }
    });

    const { error, message, affiliateDocuments } = await this.nats.firstValue(
      'affiliate.updateAffiliateDocument',
      {
        affiliateId,
        procedureDocumentId,
      },
    );

    if (!error) {
      await this.ftp.uploadFile(files, affiliateDocuments);
    }

    return {
      error,
      message,
    };
  }

  @Delete(':affiliateId/documents/:procedureDocumentId')
  @ApiResponse({ status: 200, description: 'Eliminar el documento del Afiliado' })
  async deleteDocument(
    @Param('affiliateId') affiliateId: string,
    @Param('procedureDocumentId') procedureDocumentId: string,
  ) {
    const { paths, message, error } = await this.nats.firstValue('affiliate.deleteDocument', {
      affiliateId,
      procedureDocumentId,
    });

    if (!error) {
      await this.ftp.removeFile(paths);
    }

    return {
      error: error,
      message: message,
    };
  }

  @Get(':affiliateId/documents')
  @ApiResponse({ status: 200, description: 'Mostrar Documentos del Afiliado' })
  async showDocuments(@Param('affiliateId') affiliateId: string) {
    return this.nats.send('affiliate.showDocuments', { affiliateId });
  }

  @Get(':affiliateId/showFileDossiers')
  @ApiResponse({ status: 200, description: 'Mostrar Expedientes del Afiliado' })
  async showFileDossiers(@Param('affiliateId') affiliateId: string) {
    return this.nats.send('affiliate.showFileDossiers', { affiliateId });
  }

  @Post(':affiliateId/fileDossier/:fileDossierId')
  @ApiOperation({
    summary: 'Unir chunks y subir expediente del afiliado al FTP',
    description: `Este endpoint concatena los chunks previamente subidos al servidor temporal
  y genera el archivo final del expediente. Luego, el archivo se sube al FTP en la ruta correspondiente.`,
  })
  @ApiResponse({
    status: 200,
    description: 'El expediente fue concatenado y subido exitosamente al FTP.',
  })
  @ApiResponse({
    status: 400,
    description: 'No se encontraron todos los chunks necesarios para unir el expediente.',
  })
  @ApiResponse({
    status: 500,
    description: 'Error interno del servidor durante la unión o subida del expediente.',
  })
  @ApiParam({
    name: 'affiliateId',
    description: 'ID del afiliado',
    type: Number,
    example: 123,
  })
  @ApiParam({
    name: 'fileDossierId',
    description: 'ID del expediente',
    type: Number,
    example: 456,
  })
  @ApiParam({
    name: 'totalChunks',
    description: 'Cantidad total de chunks que componen el archivo',
    type: Number,
    example: 5,
  })
  async createAffiliateFileDossier(
    @Param('affiliateId') affiliateId: string,
    @Param('fileDossierId') fileDossierId: string,
    @Body() body: any,
  ) {
    const { initialName, totalChunks } = body;
    const { affiliateFileDossiers, error, message } = await this.nats.firstValue(
      'affiliate.createAffiliateFileDossier',
      {
        affiliateId,
        fileDossierId,
      },
    );
    if (!error) {
      const fileDossiers = await this.ftp.concatChunks(+fileDossierId, initialName, +totalChunks);
      await this.ftp.uploadFile(fileDossiers, affiliateFileDossiers);
    }

    return {
      error,
      message,
    };
  }

  @Patch(':affiliateId/fileDossier/:fileDossierId')
  @ApiOperation({
    summary: 'Unir chunks y actualizar expediente del afiliado al FTP',
    description: `Este endpoint concatena los chunks previamente subidos al servidor temporal
  y genera el archivo final del expediente. Luego, el archivo se actualiza al FTP en la ruta correspondiente.`,
  })
  @ApiResponse({
    status: 200,
    description: 'El expediente fue concatenado y subido exitosamente al FTP.',
  })
  @ApiResponse({
    status: 400,
    description: 'No se encontraron todos los chunks necesarios para unir el expediente.',
  })
  @ApiResponse({
    status: 500,
    description: 'Error interno del servidor durante la unión o subida del expediente.',
  })
  @ApiParam({
    name: 'affiliateId',
    description: 'ID del afiliado',
    type: Number,
    example: 123,
  })
  @ApiParam({
    name: 'fileDossierId',
    description: 'ID del expediente',
    type: Number,
    example: 456,
  })
  @ApiParam({
    name: 'totalChunks',
    description: 'Cantidad total de chunks que componen el archivo',
    type: Number,
    example: 5,
  })
  async updateAffiliateFileDossier(
    @Param('affiliateId') affiliateId: string,
    @Param('fileDossierId') fileDossierId: string,
    @Body() body: any,
  ) {
    const { initialName, totalChunks } = body;
    const { affiliateFileDossiers, error, message } = await this.nats.firstValue(
      'affiliate.updateAffiliateFileDossier',
      {
        affiliateId,
        fileDossierId,
      },
    );

    if (!error) {
      const fileDossiers = await this.ftp.concatChunks(+fileDossierId, initialName, +totalChunks);
      await this.ftp.uploadFile(fileDossiers, affiliateFileDossiers);
    }

    return {
      error,
      message,
    };
  }

  @Get(':affiliateId/fileDossiers/:fileDossierId')
  @ApiResponse({ status: 200, description: 'Buscar el expediente del Afiliado' })
  async findFileDossier(
    @Param('affiliateId') affiliateId: string,
    @Param('fileDossierId') fileDossierId: string,
    @Res() res: Response,
  ) {
    const path = await this.nats.firstValue('affiliate.findFileDossier', {
      affiliateId,
      fileDossierId,
    });
    const fileDossiers = await this.ftp.downloadFile(path);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${affiliateId}${fileDossierId}.pdf"`,
    });
    res.send(fileDossiers[0].pdfBuffer);
  }

  @Get(':affiliateId/documents/:procedureDocumentId')
  @ApiResponse({ status: 200, description: 'Buscar el documento del Afiliado' })
  async findDocument(
    @Param('affiliateId') affiliateId: string,
    @Param('procedureDocumentId') procedureDocumentId: string,
    @Res() res: Response,
  ) {
    const affiliateDocuments = await this.nats.firstValue('affiliate.findDocument', {
      affiliateId,
      procedureDocumentId,
    });

    const documentPdf = await this.ftp.downloadFile(affiliateDocuments);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${affiliateId}${procedureDocumentId}.pdf"`,
    });

    res.send(documentPdf[0].pdfBuffer);
  }

  @Delete(':affiliateId/fileDossiers/:fileDossierId')
  @ApiResponse({ status: 200, description: 'Eliminar el expediente del Afiliado' })
  async deleteFileDossier(
    @Param('affiliateId') affiliateId: string,
    @Param('fileDossierId') fileDossierId: string,
  ) {
    const { paths, message, error } = await this.nats.firstValue('affiliate.deleteFileDossier', {
      affiliateId,
      fileDossierId,
    });

    if (!error) {
      await this.ftp.removeFile(paths);
    }

    return {
      message: message,
      error: error,
    };
  }

  @Get(':affiliateId/modality/:modalityId/collate')
  @ApiResponse({
    status: 200,
    description: 'Cotejar documentos del Afiliado con los documentos requeridos de la modalidad',
  })
  async collateDocuments(
    @Param('affiliateId') affiliateId: string,
    @Param('modalityId') modalityId: string,
  ) {
    return this.nats.send('affiliate.collateDocuments', { affiliateId, modalityId });
  }

  @Post('documents/analysis')
  async documentsAnalysis(@Body() body: { path: string; user: string; pass: string }) {
    const { path, user, pass } = body;

    return this.nats.send('affiliate.documentsAnalysis', { path, user, pass });
  }

  @Post('documents/imports')
  async documentsImports(@Body() body: object) {
    return this.nats.send('affiliate.documentsImports', body);
  }
}
