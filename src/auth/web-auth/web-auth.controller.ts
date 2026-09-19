import { Body, Controller, Header, HttpCode, HttpStatus, Post, UseFilters } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { NatsService } from 'src/common/services/nats.service';
import { WebAuthPatterns } from './contracts/web-auth.contracts';
import { CheckWebSessionDto, ExchangeWebCodeDto, StartWebLoginDto } from './dto';
import { toPublicWebAuthException } from './web-auth.errors';
import { WebAuthExceptionFilter } from './web-auth-exception.filter';
import { exchangeResponse, sessionResponse, startResponse } from './web-auth.responses';

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

  @Post('session/check')
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Comprobar una sesión web del Hub' })
  @ApiResponse({ status: 200, description: 'Sesión web válida' })
  check(@Body() request: CheckWebSessionDto) {
    return this.call(WebAuthPatterns.sessionCheck, request, sessionResponse);
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
