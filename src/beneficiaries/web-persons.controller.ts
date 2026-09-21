import {
  Controller,
  Get,
  Header,
  HttpException,
  Query,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { NatsService } from 'src/common/services/nats.service';
import { WebAuthorizationGuard } from 'src/auth/web-auth/web-authorization.guard';
import { WebAuthorize, WebProtected } from 'src/auth/web-auth/web-authorization.decorators';
import { WebAuthExceptionFilter } from 'src/auth/web-auth/web-auth-exception.filter';
import { publicWebAuthError } from 'src/auth/web-auth/web-auth.errors';
import { webNatsRequest } from 'src/auth/web-auth/web-nats-request';
import { TimeoutError } from 'rxjs';
import { FilteredPaginationDto } from './dto';

const PERSON_FIND_ALL_NATS_TIMEOUT_MS = 10_000;
// Allowlist pública de errores de negocio de person.findAll: vacía.
// Ningún statusCode, code o message remoto se interpreta en esta etapa.

function beneficiaryUnavailable(): HttpException {
  const error = publicWebAuthError('BENEFICIARY_SERVICE_UNAVAILABLE');
  return new HttpException(error.body, error.status);
}

function upstreamError(): HttpException {
  const error = publicWebAuthError('AUTH_UPSTREAM_ERROR');
  return new HttpException(error.body, error.status);
}

@ApiTags('web-beneficiaries')
@ApiCookieAuth('web-session')
@WebAuthorize('beneficiary', 'persons')
@Controller('web/beneficiaries/persons')
@UseFilters(WebAuthExceptionFilter)
export class WebPersonsController {
  constructor(private readonly nats: NatsService) {}

  @Get()
  @UseGuards(WebAuthorizationGuard)
  @WebProtected('read')
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  @ApiOperation({ summary: 'Listar personas mediante autorización web UMA' })
  @ApiResponse({ status: 200, description: 'Listado de personas' })
  @ApiResponse({ status: 401, description: 'Sesión web inválida' })
  @ApiResponse({ status: 403, description: 'Operación no autorizada' })
  @ApiResponse({ status: 503, description: 'Servicio temporalmente no disponible' })
  async findAll(@Query() filterDto: FilteredPaginationDto) {
    try {
      return await webNatsRequest(
        this.nats,
        'person.findAll',
        filterDto,
        PERSON_FIND_ALL_NATS_TIMEOUT_MS,
      );
    } catch (error) {
      if (error instanceof TimeoutError) throw beneficiaryUnavailable();
      throw upstreamError();
    }
  }
}
