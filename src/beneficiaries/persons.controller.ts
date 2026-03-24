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
import { ApiResponse, ApiTags, ApiSecurity } from '@nestjs/swagger';
import { FtpService, NatsService } from 'src/common';
import { Records } from 'src/records/records.interceptor';
import { FilteredPaginationDto } from './dto';
import { Authorize, Protected } from 'src/auth/decorators';

@ApiTags('beneficiaries')
@ApiSecurity('origin-header')
@Authorize('beneficiary-interface', 'persons')
@UseInterceptors(Records)
@Controller('beneficiaries/persons')
export class PersonsController {
  constructor(
    private readonly nats: NatsService,
    private readonly ftp: FtpService,
  ) {}

  @Protected('read', 'listFingerprints')
  @Get('showListFingerprint')
  @ApiResponse({
    status: 200,
    description: 'Mostrar el listado de huellas digitales',
  })
  async showListFingerprint() {
    return this.nats.send('person.showListFingerprint', {});
  }

  @Protected('read')
  @Get()
  @ApiResponse({ status: 200, description: 'Mostrar todas las personas' })
  findAllPersons(@Query() filterDto: FilteredPaginationDto) {
    return this.nats.send('person.findAll', filterDto);
  }

  @Protected('read')
  @Get(':term')
  @ApiResponse({ status: 200, description: 'Mostrar una persona' })
  async findOnePersons(@Param('term') term: string) {
    return this.nats.send('person.findOne', { term, field: 'id' });
  }

  @Protected('read')
  @Get(':uuid/details')
  @ApiResponse({
    status: 200,
    description: 'Muestra una persona con sus relaciones y características adicionales',
  })
  async findPerson(@Param('uuid', new ParseUUIDPipe()) uuid: string) {
    return this.nats.send('person.findOneWithFeatures', { uuid });
  }
  @Protected('read')
  @Get(':personId/beneficiaries')
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

  @Protected('read', 'affiliates')
  @Get(':personId/affiliates')
  @ApiResponse({
    status: 200,
    description: 'Mostrar los afiliados relacionados con una persona',
  })
  async findAffiliteRelatedWithPerson(@Param('personId') id: string) {
    return this.nats.send('person.findAffiliates', { id });
  }

  @Protected('write', 'fingerprints')
  @Post(':personId/createPersonFingerprint')
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

  @Protected('read', 'fingerprints')
  @Get('showPersonFingerprint/:id')
  @ApiResponse({
    status: 200,
    description: 'Mostrar el listado de huellas digitales de una persona',
  })
  async showFingerprintRegistered(@Param('id') id: string) {
    return this.nats.send('person.showFingerprintRegistered', { id });
  }

  @Protected('read', 'records')
  @Get('records/:personId')
  @ApiResponse({
    status: 200,
    description: 'Obtener los registros de una persona por su ID',
  })
  async getPersonRecords(@Param('personId', ParseIntPipe) personId: number) {
    return this.nats.firstValue('person.getPersonRecords', { personId });
  }

  @Protected('read')
  @Get('search/:value/:type')
  @ApiResponse({
    status: 200,
    description: 'Buscar un afiliado',
  })
  async searchAffiliate(@Param('value') value: string, @Param('type') type: string) {
    return this.nats.send('person.search', { value, type });
  }
}
