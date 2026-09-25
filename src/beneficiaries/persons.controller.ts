import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { ApiResponse, ApiTags } from '@nestjs/swagger';
import { WebController, WebPermission } from 'src/auth/decorators/web-authorization.decorators';
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
}
