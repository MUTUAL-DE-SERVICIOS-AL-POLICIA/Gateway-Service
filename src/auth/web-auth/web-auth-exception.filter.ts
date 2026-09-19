import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import { Response } from 'express';
import { publicWebAuthError, WebAuthGatewayErrorCode } from './web-auth.errors';

const publicCodes = new Set<WebAuthGatewayErrorCode>([
  'INVALID_LOGIN_REQUEST',
  'LOGIN_STATE_INVALID',
  'SESSION_INVALID',
  'WEB_AUTH_DISABLED',
  'AUTH_SERVICE_UNAVAILABLE',
  'OIDC_LOGIN_FAILED',
  'AUTH_UPSTREAM_ERROR',
]);

function codeFrom(error: HttpException): WebAuthGatewayErrorCode | undefined {
  const response = error.getResponse();
  if (!response || typeof response !== 'object') return undefined;
  const body = response as Record<string, unknown>;
  if (!body.error || typeof body.error !== 'object') return undefined;
  const code = (body.error as Record<string, unknown>).code;
  return typeof code === 'string' && publicCodes.has(code as WebAuthGatewayErrorCode)
    ? (code as WebAuthGatewayErrorCode)
    : undefined;
}

@Catch()
export class WebAuthExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const code =
      exception instanceof BadRequestException
        ? 'INVALID_LOGIN_REQUEST'
        : exception instanceof HttpException
          ? (codeFrom(exception) ?? 'AUTH_UPSTREAM_ERROR')
          : 'AUTH_UPSTREAM_ERROR';
    const error = publicWebAuthError(code);
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Pragma', 'no-cache');
    response.status(error.status).json(error.body);
  }
}
