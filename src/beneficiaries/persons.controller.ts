import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiCookieAuth, ApiResponse, ApiTags } from '@nestjs/swagger';
import { WebAuthorizationGuard } from 'src/auth/web-auth/web-authorization.guard';
import { WebAuthorize, WebProtected } from 'src/auth/web-auth/web-authorization.decorators';
import { FtpService, NatsService, RecordsService } from 'src/common';
import { FilteredPaginationDto } from './dto';

@ApiCookieAuth('web-session')
@ApiTags('beneficiaries')
@UseGuards(WebAuthorizationGuard)
@UseInterceptors(RecordsService)
@Controller('beneficiaries/persons')
export class PersonsController {
  constructor(
    private readonly nats: NatsService,
    private readonly ftp: FtpService,
  ) {}

  @Get('showListFingerprint')
  @WebAuthorize('beneficiary', 'persons.fingerprints')
  @WebProtected('read')
  @ApiResponse({
    status: 200,
    description: 'Mostrar el listado de huellas digitales',
  })
  async showListFingerprint() {
    return this.nats.send('person.showListFingerprint', {});
  }

  @Get()
  @WebAuthorize('beneficiary', 'persons')
  @WebProtected('read')
  @ApiResponse({ status: 200, description: 'Mostrar todas las personas' })
  findAllPersons(@Query() filterDto: FilteredPaginationDto) {
    return this.nats.send('person.findAll', filterDto);
  }

  @Get(':term')
  @WebAuthorize('beneficiary', 'persons')
  @WebProtected('read')
  @ApiResponse({ status: 200, description: 'Mostrar una persona' })
  async findOnePersons(@Param('term') term: string) {
    return this.nats.send('person.findOne', { term, field: 'id' });
  }

  @Get(':uuid/details')
  @WebAuthorize('beneficiary', 'persons')
  @WebProtected('read')
  @ApiResponse({
    status: 200,
    description: 'Muestra una persona con sus relaciones y características adicionales',
  })
  async findPerson(@Param('uuid', new ParseUUIDPipe()) uuid: string) {
    return this.nats.send('person.findOneWithFeatures', { uuid });
  }
  @Get(':personId/beneficiaries')
  @WebAuthorize('beneficiary', 'persons')
  @WebProtected('read')
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
  @WebAuthorize('beneficiary', 'persons.affiliates')
  @WebProtected('read')
  @ApiResponse({
    status: 200,
    description: 'Mostrar los afiliados relacionados con una persona',
  })
  async findAffiliteRelatedWithPerson(@Param('personId') id: string) {
    return this.nats.send('person.findAffiliates', { id });
  }

  @Post(':personId/createPersonFingerprint')
  @WebAuthorize('beneficiary', 'persons.fingerprints')
  @WebProtected('write')
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
  @WebAuthorize('beneficiary', 'persons.fingerprints')
  @WebProtected('read')
  @ApiResponse({
    status: 200,
    description: 'Mostrar el listado de huellas digitales de una persona',
  })
  async showFingerprintRegistered(@Param('id') id: string) {
    return this.nats.send('person.showFingerprintRegistered', { id });
  }

  @Get('records/:personId')
  @WebAuthorize('beneficiary', 'persons.records')
  @WebProtected('read')
  @ApiResponse({
    status: 200,
    description: 'Obtener los registros de una persona por su ID',
  })
  async getPersonRecords(@Param('personId', ParseIntPipe) personId: number) {
    return this.nats.firstValue('person.getPersonRecords', { personId });
  }

  @Get('search/:value/:type')
  @WebAuthorize('beneficiary', 'persons')
  @WebProtected('read')
  @ApiResponse({
    status: 200,
    description: 'Buscar un afiliado',
  })
  async searchAffiliate(@Param('value') value: string, @Param('type') type: string) {
    return this.nats.send('person.search', { value, type });
  }
}
