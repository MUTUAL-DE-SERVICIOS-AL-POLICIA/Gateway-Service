import {
  Body,
  Controller,
  Delete,
  Header,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  UseFilters,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { NatsService } from 'src/common/services/nats.service';
import { WebAuthPatterns } from './contracts/web-auth.contracts';
import {
  CheckWebSessionDto,
  BackchannelLogoutDto,
  EnsureWebClientContextDto,
  ExchangeWebCodeDto,
  StartWebLoginDto,
} from './dto';
import { toPublicWebAuthException } from './web-auth.errors';
import { WebAuthExceptionFilter } from './web-auth-exception.filter';
import {
  clientContextResponse,
  exchangeResponse,
  logoutResponse,
  sessionResponse,
  startResponse,
} from './web-auth.responses';
import { sidFromCookie } from './web-session-cookie';
import { webNatsRequest } from './web-nats-request';

const CLIENT_BOOTSTRAP_TIMEOUT_MS = 12_000;

@ApiTags('web-auth')
@Controller('auth')
@UseFilters(WebAuthExceptionFilter)
export class WebAuthController {
  constructor(private readonly nats: NatsService) {}

  @Post('login/start')
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Iniciar autenticación OIDC del Hub' })
  @ApiResponse({ status: 200, description: 'URL de autorización creada' })
  start(@Body() request: StartWebLoginDto) {
    return this.call(WebAuthPatterns.loginStart, request, startResponse);
  }

  @Post('exchange')
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Intercambiar código OIDC por sesión web' })
  @ApiResponse({ status: 200, description: 'Sesión web creada' })
  exchange(@Body() request: ExchangeWebCodeDto) {
    return this.call(WebAuthPatterns.loginExchange, request, exchangeResponse);
  }

  @Delete('logout')
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  @HttpCode(HttpStatus.OK)
  @ApiHeader({
    name: 'Cookie',
    required: true,
    description: 'Cookie HttpOnly sid requerida',
    schema: { type: 'string' },
  })
  @ApiOperation({ summary: 'Cerrar la sesión web global' })
  @ApiResponse({ status: 200, description: 'URL de cierre OIDC creada' })
  logout(@Headers('cookie') cookieHeader: string | undefined) {
    const sid = sidFromCookie(cookieHeader);
    return this.call(WebAuthPatterns.logout, { sid }, logoutResponse);
  }

  @Post('session/check')
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Comprobar una sesión web del Hub' })
  @ApiResponse({ status: 200, description: 'Sesión web válida' })
  check(@Body() request: CheckWebSessionDto) {
    return this.call(WebAuthPatterns.sessionCheck, request, sessionResponse);
  }

  @Post('backchannel-logout')
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Procesar logout back-channel de Keycloak' })
  @ApiResponse({ status: 204, description: 'Logout procesado' })
  backchannelLogout(@Body() request: BackchannelLogoutDto): Promise<void> {
    return this.call(
      WebAuthPatterns.backchannelLogout,
      { logoutToken: request.logout_token },
      () => undefined,
    );
  }

  @Post('client/context')
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  @HttpCode(HttpStatus.OK)
  @ApiHeader({
    name: 'Cookie',
    required: true,
    description: 'Cookie HttpOnly sid requerida',
    schema: { type: 'string' },
  })
  @ApiOperation({
    summary: 'Preparar el contexto web de una herramienta permitida',
    description:
      'Diseñado para BFF. La herramienta no concede autorización; Auth resuelve el catálogo y UMA mantiene la decisión final.',
  })
  @ApiResponse({
    status: 200,
    description: 'Contexto informativo preparado sin tokens',
  })
  @ApiResponse({ status: 400, description: 'Solicitud inválida' })
  @ApiResponse({ status: 401, description: 'Sesión inválida' })
  @ApiResponse({ status: 403, description: 'Herramienta no disponible' })
  @ApiResponse({ status: 502, description: 'Respuesta de autenticación inválida' })
  @ApiResponse({ status: 503, description: 'Servicio de autenticación no disponible' })
  ensureClientContext(
    @Headers('cookie') cookieHeader: string | undefined,
    @Body() request: EnsureWebClientContextDto,
  ) {
    const sid = sidFromCookie(cookieHeader);
    return this.callWithTimeout(
      WebAuthPatterns.clientEnsure,
      { sid, tool: request.tool },
      clientContextResponse,
    );
  }

  private async callWithTimeout<T>(
    pattern: string,
    request: unknown,
    sanitize: (value: unknown) => T,
  ): Promise<T> {
    try {
      const response = await webNatsRequest<unknown>(
        this.nats,
        pattern,
        request,
        CLIENT_BOOTSTRAP_TIMEOUT_MS,
      );
      return sanitize(response);
    } catch (error) {
      throw toPublicWebAuthException(error);
    }
  }

  private async call<T>(
    pattern: string,
    request: unknown,
    sanitize: (value: unknown) => T,
  ): Promise<T> {
    try {
      const response: unknown = await this.nats.firstValue(pattern, request);
      return sanitize(response);
    } catch (error) {
      throw toPublicWebAuthException(error);
    }
  }
}
