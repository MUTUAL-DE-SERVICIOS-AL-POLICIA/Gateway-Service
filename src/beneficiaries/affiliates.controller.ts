import {
  BadRequestException,
  Body,
  Controller,
  Delete,
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

  @Get(':affiliateId')
  @ApiResponse({ status: 200, description: 'Mostrar datos del afiliado' })
  async findOneData(@Param('affiliateId') affiliateId: string) {
    return this.nats.send('affiliate.findOneData', { affiliateId });
  }

  @Post(':affiliateId/document/:procedureDocumentId/createOrUpdate')
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
  async createOrUpdateDocument(
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

    const { serviceStatus, message, affiliateDocuments } = await this.nats.firstValue(
      'affiliate.createOrUpdateDocument',
      {
        affiliateId,
        procedureDocumentId,
      },
    );

    await this.ftp.uploadFile(files, affiliateDocuments);

    return {
      serviceStatus,
      message,
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

  @Post(':affiliateId/fileDossier/:fileDossierId/createOrUpdateFileDossier')
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
  async createOrUpdateFileDossier(
    @Param('affiliateId') affiliateId: string,
    @Param('fileDossierId') fileDossierId: string,
    @Body() body: any,
  ) {
    const { initialName, totalChunks } = body;
    const { affiliateFileDossiers, serviceStatus, message } = await this.nats.firstValue(
      'affiliate.createOrUpdateFileDossier',
      {
        affiliateId,
        fileDossierId,
      },
    );

    const fileDossiers = await this.ftp.concatChunks(+fileDossierId, initialName, +totalChunks);
    await this.ftp.uploadFile(fileDossiers, affiliateFileDossiers);

    return {
      serviceStatus,
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
    const { paths, message } = await this.nats.firstValue('affiliate.deleteFileDossier', {
      affiliateId,
      fileDossierId,
    });
    await this.ftp.removeFile(paths);
    return {
      message: message,
      serviceStatus: true,
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
