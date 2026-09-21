import { CanActivate, ExecutionContext, HttpException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { TimeoutError } from 'rxjs';
import { NatsService } from 'src/common/services/nats.service';
import { WebAuthPatterns, WebAuthorizationOperation } from './contracts/web-auth.contracts';
import { publicWebAuthError, toPublicWebAuthException } from './web-auth.errors';
import { authorizationResponse } from './web-auth.responses';
import { sidFromCookie } from './web-session-cookie';
import { WEB_OPERATION_METADATA } from './web-operation.decorator';
import { webNatsRequest } from './web-nats-request';

const knownOperations = new Set<WebAuthorizationOperation>(['beneficiary.persons.read']);
const AUTHORIZATION_NATS_TIMEOUT_MS = 5_000;

function publicException(
  code: 'INVALID_AUTHORIZATION_REQUEST' | 'AUTHORIZATION_DENIED',
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
    const operation = this.reflector.getAllAndOverride<WebAuthorizationOperation>(
      WEB_OPERATION_METADATA,
      [context.getHandler(), context.getClass()],
    );
    if (!operation || !knownOperations.has(operation)) {
      throw publicException('INVALID_AUTHORIZATION_REQUEST');
    }

    const request = context.switchToHttp().getRequest<Request>();
    const sid = sidFromCookie(request.headers.cookie);
    try {
      const response = authorizationResponse(
        await webNatsRequest(
          this.nats,
          WebAuthPatterns.authorizationCheck,
          { sid, operation },
          AUTHORIZATION_NATS_TIMEOUT_MS,
        ),
      );
      if (!response.authorized) throw publicException('AUTHORIZATION_DENIED');
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
