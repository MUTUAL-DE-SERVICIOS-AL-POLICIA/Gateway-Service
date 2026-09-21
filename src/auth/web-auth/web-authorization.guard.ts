import { CanActivate, ExecutionContext, HttpException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { TimeoutError } from 'rxjs';
import { NatsService } from 'src/common/services/nats.service';
import { WebAuthPatterns } from './contracts/web-auth.contracts';
import { publicWebAuthError, toPublicWebAuthException } from './web-auth.errors';
import { authorizationResponse } from './web-auth.responses';
import { sidFromCookie } from './web-session-cookie';
import {
  WEB_AUTHORIZE_METADATA,
  WEB_PROTECTED_METADATA,
  WebAuthorizeMetadata,
  WebProtectedMetadata,
} from './web-authorization.decorators';
import { webNatsRequest } from './web-nats-request';

const AUTHORIZATION_NATS_TIMEOUT_MS = 5_000;
const TOOL_KEY = /^[a-z][a-z0-9-]{0,63}$/;
const AUTHORIZATION_IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

interface WebAuthorizedRequest extends Request {
  user?: {
    username: string;
    name?: string;
  };
}

function publicException(
  code: 'INVALID_AUTHORIZATION_REQUEST' | 'AUTHORIZATION_DENIED' | 'AUTHORIZATION_CONTEXT_INVALID',
): HttpException {
  const error = publicWebAuthError(code);
  return new HttpException(error.body, error.status);
}

@Injectable()
export class WebAuthorizationGuard implements CanActivate {
  constructor(
    private readonly nats: NatsService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const authorize = this.reflector.getAllAndOverride<WebAuthorizeMetadata>(
      WEB_AUTHORIZE_METADATA,
      [context.getHandler(), context.getClass()],
    );
    const protectedMetadata = this.reflector.getAllAndOverride<WebProtectedMetadata>(
      WEB_PROTECTED_METADATA,
      [context.getHandler(), context.getClass()],
    );
    if (
      !isPlainMetadata(authorize, ['tool', 'resource']) ||
      !isPlainMetadata(protectedMetadata, ['scope']) ||
      !TOOL_KEY.test(authorize.tool) ||
      !AUTHORIZATION_IDENTIFIER.test(authorize.resource) ||
      !AUTHORIZATION_IDENTIFIER.test(protectedMetadata.scope)
    ) {
      throw publicException('INVALID_AUTHORIZATION_REQUEST');
    }
    const request = context.switchToHttp().getRequest<WebAuthorizedRequest>();
    if (request.user !== undefined) {
      throw publicException('AUTHORIZATION_CONTEXT_INVALID');
    }
    const sid = sidFromCookie(request.headers.cookie);
    try {
      const response = authorizationResponse(
        await webNatsRequest(
          this.nats,
          WebAuthPatterns.authorizationCheck,
          {
            sid,
            tool: authorize.tool,
            resource: authorize.resource,
            scope: protectedMetadata.scope,
          },
          AUTHORIZATION_NATS_TIMEOUT_MS,
        ),
      );
      if (!response.authorized) throw publicException('AUTHORIZATION_DENIED');
      request.user = {
        username: response.actor.preferredUsername ?? response.actor.sub,
        name: response.actor.name,
      };
      return true;
    } catch (error) {
      if (error instanceof TimeoutError) {
        const unavailable = publicWebAuthError('AUTH_SERVICE_UNAVAILABLE');
        throw new HttpException(unavailable.body, unavailable.status);
      }
      throw toPublicWebAuthException(error);
    }
  }
}

function isPlainMetadata(value: unknown, keys: readonly string[]): value is Record<string, string> {
  return (
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype &&
    Object.keys(value).length === keys.length &&
    keys.every(
      (key) =>
        Object.prototype.hasOwnProperty.call(value, key) &&
        typeof (value as Record<string, unknown>)[key] === 'string',
    )
  );
}
