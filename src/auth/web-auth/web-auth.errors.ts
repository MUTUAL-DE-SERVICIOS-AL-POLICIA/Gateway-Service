import { HttpException, HttpStatus } from '@nestjs/common';

export type WebAuthGatewayErrorCode =
  | 'INVALID_LOGIN_REQUEST'
  | 'LOGIN_STATE_INVALID'
  | 'SESSION_INVALID'
  | 'WEB_AUTH_DISABLED'
  | 'AUTH_SERVICE_UNAVAILABLE'
  | 'OIDC_LOGIN_FAILED'
  | 'INVALID_CLIENT_REQUEST'
  | 'WEB_TOOL_UNAVAILABLE'
  | 'WEB_CLIENT_ACCESS_DENIED'
  | 'WEB_CLIENT_INVALID'
  | 'INVALID_AUTHORIZATION_REQUEST'
  | 'AUTHORIZATION_DENIED'
  | 'AUTHORIZATION_CONTEXT_INVALID'
  | 'BENEFICIARY_SERVICE_UNAVAILABLE'
  | 'AUTH_UPSTREAM_ERROR';

interface ErrorDefinition {
  status: HttpStatus;
  message: string;
}

const definitions: Record<WebAuthGatewayErrorCode, ErrorDefinition> = {
  INVALID_LOGIN_REQUEST: {
    status: HttpStatus.BAD_REQUEST,
    message: 'Invalid login request',
  },
  LOGIN_STATE_INVALID: {
    status: HttpStatus.UNAUTHORIZED,
    message: 'Login state is invalid or expired',
  },
  SESSION_INVALID: {
    status: HttpStatus.UNAUTHORIZED,
    message: 'Session is invalid or expired',
  },
  WEB_AUTH_DISABLED: {
    status: HttpStatus.SERVICE_UNAVAILABLE,
    message: 'Web authentication is disabled',
  },
  AUTH_SERVICE_UNAVAILABLE: {
    status: HttpStatus.SERVICE_UNAVAILABLE,
    message: 'Authentication service is unavailable',
  },
  OIDC_LOGIN_FAILED: {
    status: HttpStatus.BAD_GATEWAY,
    message: 'OIDC login failed',
  },
  INVALID_CLIENT_REQUEST: {
    status: HttpStatus.BAD_REQUEST,
    message: 'Invalid web client request',
  },
  WEB_TOOL_UNAVAILABLE: {
    status: HttpStatus.FORBIDDEN,
    message: 'Web tool is unavailable',
  },
  WEB_CLIENT_ACCESS_DENIED: {
    status: HttpStatus.FORBIDDEN,
    message: 'Web client access was denied',
  },
  WEB_CLIENT_INVALID: {
    status: HttpStatus.BAD_GATEWAY,
    message: 'Web client response is invalid',
  },
  INVALID_AUTHORIZATION_REQUEST: {
    status: HttpStatus.BAD_REQUEST,
    message: 'Invalid authorization request',
  },
  AUTHORIZATION_DENIED: {
    status: HttpStatus.FORBIDDEN,
    message: 'Authorization denied',
  },
  AUTHORIZATION_CONTEXT_INVALID: {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    message: 'Authorization context is invalid',
  },
  BENEFICIARY_SERVICE_UNAVAILABLE: {
    status: HttpStatus.SERVICE_UNAVAILABLE,
    message: 'Beneficiary service is unavailable',
  },
  AUTH_UPSTREAM_ERROR: {
    status: HttpStatus.BAD_GATEWAY,
    message: 'Authentication request failed',
  },
};

export function publicWebAuthError(code: WebAuthGatewayErrorCode): {
  status: HttpStatus;
  body: { error: { code: WebAuthGatewayErrorCode; message: string } };
} {
  const definition = definitions[code];
  return {
    status: definition.status,
    body: { error: { code, message: definition.message } },
  };
}

function errorCode(value: unknown): string | undefined {
  if (value instanceof HttpException) return errorCode(value.getResponse());
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  if (typeof record.code === 'string') return record.code;
  if (record.error && typeof record.error === 'object') return errorCode(record.error);
  if (record.response && typeof record.response === 'object') return errorCode(record.response);
  return undefined;
}

export function toPublicWebAuthException(error: unknown): HttpException {
  const code = errorCode(error);
  if (code && Object.prototype.hasOwnProperty.call(definitions, code)) {
    const publicCode = code as WebAuthGatewayErrorCode;
    const error = publicWebAuthError(publicCode);
    return new HttpException(error.body, error.status);
  }
  const fallback = publicWebAuthError('AUTH_UPSTREAM_ERROR');
  return new HttpException(fallback.body, fallback.status);
}
