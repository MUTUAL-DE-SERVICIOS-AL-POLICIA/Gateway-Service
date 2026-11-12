import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import {
  WebController,
  WebPermission,
} from 'src/auth/decorators/web-authorization.decorators';
import { FtpService, NatsService, RecordsService } from 'src/common';
import { FilteredPaginationDto } from './dto';

@ApiTags('beneficiaries')
@WebController('beneficiary', 'persons')
@UseInterceptors(RecordsService)
@Controller('beneficiaries/persons')
export class PersonsController {
  constructor(
    private readonly nats: NatsService,
    private readonly ftp: FtpService,
  ) {}

  @Get('showListFingerprint')
  @WebPermission('read', 'fingerprints')
  @ApiResponse({
    status: 200,
    description: 'Mostrar el listado de huellas digitales',
  })
  async showListFingerprint() {
    return this.nats.send('person.showListFingerprint', {});
  }

  @Get()
  @WebPermission('read')
  @ApiResponse({ status: 200, description: 'Mostrar todas las personas' })
  findAllPersons(@Query() filterDto: FilteredPaginationDto) {
    return this.nats.send('person.findAll', filterDto);
  }

  @Get(':term')
  @WebPermission('read')
  @ApiResponse({ status: 200, description: 'Mostrar una persona' })
  async findOnePersons(@Param('term') term: string) {
    return this.nats.send('person.findOne', { term, field: 'id' });
  }

  @Get(':uuid/details')
  @WebPermission('read')
  @ApiResponse({
    status: 200,
    description: 'Muestra una persona con sus relaciones y características adicionales',
  })
  async findPerson(@Param('uuid', new ParseUUIDPipe()) uuid: string) {
    return this.nats.send('person.findOneWithFeatures', { uuid });
  }
  @Get(':personId/beneficiaries')
  @WebPermission('read')
  @ApiResponse({
    status: 200,
    description: 'Mostrar los beneficiarios de una persona',
  })
  async findBeneficiaries(@Param('personId') id: string) {
    return this.nats.send('person.getBeneficiariesOfAffiliate', { id });
  }

  async showPersonsRelatedToAffiliate(@Param('id') id: string) {
    return this.nats.send('person.showPersonsRelatedToAffiliate', { id });
  }

  @Get(':personId/affiliates')
  @WebPermission('read', 'affiliates')
  @ApiResponse({
    status: 200,
    description: 'Mostrar los afiliados relacionados con una persona',
  })
  async findAffiliteRelatedWithPerson(@Param('personId') id: string) {
    return this.nats.send('person.findAffiliates', { id });
  }

  @Post(':personId/createPersonFingerprint')
  @WebPermission('write', 'fingerprints')
  @ApiResponse({
    status: 200,
    description: 'Crear una huella digital de una persona',
  })
  @ApiResponse({
    status: 400,
    description: 'Error de validación de entrada',
  })
  @ApiResponse({
    status: 500,
    description: 'Error interno del servidor',
  })
  @ApiResponse({
    status: 200,
    description: 'Crear una huella digital de una persona',
  })
  async createPersonFingerprint(
    @Param('personId', ParseIntPipe) personId: string,
    @Body() body: { personFingerprints: any[]; wsqFingerprints: any[] },
  ) {
    const { message, registros, uploadFiles, removeFiles } = await this.nats.firstValue(
      'person.createPersonFingerprint',
      {
        personId,
        personFingerprints: body.personFingerprints,
        wsqFingerprints: body.wsqFingerprints,
      },
    );
    await this.ftp.removeFile(removeFiles);
    await this.ftp.uploadFile(body.wsqFingerprints, uploadFiles, 'true');

    return {
      message,
      registros,
    };
  }

  @Get('showPersonFingerprint/:id')
  @WebPermission('read', 'fingerprints')
  @ApiResponse({
    status: 200,
    description: 'Mostrar el listado de huellas digitales de una persona',
  })
  async showFingerprintRegistered(@Param('id') id: string) {
    return this.nats.send('person.showFingerprintRegistered', { id });
  }

  @Get('records/:personId')
  @WebPermission('read', 'records')
  @ApiResponse({
    status: 200,
    description: 'Obtener los registros de una persona por su ID',
  })
  async getPersonRecords(@Param('personId', ParseIntPipe) personId: number) {
    return this.nats.firstValue('person.getPersonRecords', { personId });
  }

  @Get('search/:value/:type')
  @WebPermission('read')
  @ApiResponse({
    status: 200,
    description: 'Buscar un afiliado',
  })
  async searchAffiliate(@Param('value') value: string, @Param('type') type: string) {
    return this.nats.send('person.search', { value, type });
  }

  @Post(':personId/createPhoto/:identityCard')
  @WebPermission('write', 'photos')
  @UseInterceptors(AnyFilesInterceptor())
  @ApiResponse({
    status: 200,
    description: 'Crear una foto de una persona',
  })
  @ApiResponse({
    status: 400,
    description: 'Error de validación de entrada',
  })
  @ApiResponse({
    status: 500,
    description: 'Error interno del servidor',
  })
  async createPhoto(
    @Param('personId', ParseIntPipe) personId: number,
    @Param('identityCard') identityCard: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    // if (!files || files.length === 0) {
    //   throw new BadRequestException('Debe subir al menos un archivo PDF');
    // }

    // files.forEach((file) => {
    //   if (file.mimetype !== 'application/pdf') {
    //     throw new BadRequestException('Todos los archivos deben ser PDF');
    //   }
    // });
    const { error, message, personPhotos } = await this.nats.firstValue(
      'person.createPhoto',
      { personId, identityCard },
    );

    if (!error) {
      await this.ftp.uploadFile(files, personPhotos);
    }

    return {
      error,
      message,
    };
  }

  @Patch(':personId/updatePhoto/:identityCard')
  @WebPermission('update', 'photos')
  @UseInterceptors(AnyFilesInterceptor())
  @ApiResponse({
    status: 200,
    description: 'Actualizar una foto de una persona',
  })
  @ApiResponse({
    status: 400,
    description: 'Error de validación de entrada',
  })
  @ApiResponse({
    status: 500,
    description: 'Error interno del servidor',
  })
  async updatePhoto(
    @Param('personId', ParseIntPipe) personId: number,
    @Param('identityCard') identityCard: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    // if (!files || files.length === 0) {
    //   throw new BadRequestException('Debe subir al menos un archivo PDF');
    // }

    // files.forEach((file) => {
    //   if (file.mimetype !== 'application/pdf') {
    //     throw new BadRequestException('Todos los archivos deben ser PDF');
    //   }
    // });
    const { error, message, personPhotos } = await this.nats.firstValue(
      'person.updatePhoto',
      { personId, identityCard },
    );

    if (!error) {
      await this.ftp.uploadFile(files, personPhotos);
    }

    return {
      error,
      message,
    };
  }

  @Delete(':personId/deletePhoto')
  @WebPermission('delete', 'photos')
  async deletePhoto(@Param('personId', ParseIntPipe) personId: number) {
    return this.nats.firstValue('person.deletePhoto', { personId });
  }

  @Get(':personId/photo')
  @WebPermission('read', 'photos')
  async findPersonPhoto(
    @Param('personId', ParseIntPipe) personId: number,
    @Res() res: Response,
  ) {
    const personPhoto = await this.nats.firstValue('person.findPhoto', { personId });

    const file = await this.ftp.downloadFile(personPhoto);

    res.set({
      'Content-Type': personPhoto.mimeType ?? 'image/jpeg',
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      Pragma: 'no-cache',
      Expires: '0',
    });

    res.send(file[0].pdfBuffer);
  }
}
