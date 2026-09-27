import { CanActivate, ExecutionContext, HttpException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request, Response } from 'express';
import { TimeoutError } from 'rxjs';
import { WebAuthPatterns } from '../contracts/web-auth.contracts';
import {
  WEB_CONTROLLER_METADATA,
  WEB_PERMISSION_METADATA,
  WEB_SHARED_SESSION_METADATA,
  WEB_SESSION_ONLY_METADATA,
  WebControllerMetadata,
  WebPermissionMetadata,
} from '../decorators/web-authorization.metadata';
import { publicWebAuthError, toPublicWebAuthException } from '../errors/web-auth.errors';
import { authorizationResponse, clientCheckResponse } from '../utils/web-auth.responses';
import { webNatsRequest } from '../utils/web-nats-request';
import { setWebNoStoreHeaders } from '../utils/web-no-store';
import { sidFromCookie } from '../utils/web-session-cookie';
import { NatsService } from 'src/common/services/nats.service';

const AUTHORIZATION_NATS_TIMEOUT_MS = 5_000;
const TOOL_KEY = /^[a-z][a-z0-9-]{0,63}$/;
const AUTHORIZATION_IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const SUBRESOURCE_IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const WEB_TOOL_HEADER = 'x-muserpol-tool';

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
    setWebNoStoreHeaders(context.switchToHttp().getResponse<Response>());
    const controller = this.reflector.getAllAndOverride<WebControllerMetadata>(
      WEB_CONTROLLER_METADATA,
      [context.getHandler(), context.getClass()],
    );
    const permission = this.reflector.get<WebPermissionMetadata>(
      WEB_PERMISSION_METADATA,
      context.getHandler(),
    );
    const sessionOnly =
      this.reflector.get<unknown>(WEB_SESSION_ONLY_METADATA, context.getHandler()) === true;
    const sharedSession =
      this.reflector.get<unknown>(WEB_SHARED_SESSION_METADATA, context.getHandler()) === true;
    const controllerMode = validControllerMetadata(controller);
    const validControllerMode =
      controllerMode &&
      !sharedSession &&
      Number(permission !== undefined) + Number(sessionOnly) === 1;
    const validSharedMode =
      controller === undefined && permission === undefined && !sessionOnly && sharedSession;

    if (!validControllerMode && !validSharedMode) {
      throw publicException('INVALID_AUTHORIZATION_REQUEST');
    }
    if (permission !== undefined && !validPermissionMetadata(permission)) {
      throw publicException('INVALID_AUTHORIZATION_REQUEST');
    }

    const request = context.switchToHttp().getRequest<WebAuthorizedRequest>();
    if (request.user !== undefined) {
      throw publicException('AUTHORIZATION_CONTEXT_INVALID');
    }
    const sid = sidFromCookie(request.headers.cookie);

    try {
      if (permission !== undefined && controllerMode) {
        const resource = permission.subresource
          ? `${controller.resource}.${permission.subresource}`
          : controller.resource;
        const response = authorizationResponse(
          await webNatsRequest(
            this.nats,
            WebAuthPatterns.authorizationCheck,
            { sid, tool: controller.tool, resource, scope: permission.scope },
            AUTHORIZATION_NATS_TIMEOUT_MS,
          ),
        );
        if (!response.authorized) throw publicException('AUTHORIZATION_DENIED');
        request.user = {
          username: response.actor.preferredUsername ?? response.actor.sub,
          name: response.actor.name,
        };
      } else {
        const tool = controllerMode ? controller.tool : toolFromInternalHeader(request);
        const response = clientCheckResponse(
          await webNatsRequest(
            this.nats,
            WebAuthPatterns.clientCheck,
            { sid, tool },
            AUTHORIZATION_NATS_TIMEOUT_MS,
          ),
        );
        if (response.currentTool !== tool) throw new Error('Invalid web client check response');
        request.user = {
          username: response.actor.preferredUsername ?? response.actor.sub,
          name: response.actor.name,
        };
      }
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

function toolFromInternalHeader(request: Request): string {
  const value = request.headers[WEB_TOOL_HEADER];
  if (typeof value !== 'string' || !TOOL_KEY.test(value))
    throw publicException('INVALID_AUTHORIZATION_REQUEST');
  return value;
}

function validControllerMetadata(value: unknown): value is WebControllerMetadata {
  return (
    isPlainMetadata(value, ['tool', 'resource']) &&
    TOOL_KEY.test(value.tool) &&
    AUTHORIZATION_IDENTIFIER.test(value.resource)
  );
}

function validPermissionMetadata(value: unknown): value is WebPermissionMetadata {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  if (Object.getPrototypeOf(value) !== Object.prototype) return false;
  const metadata = value as Record<string, unknown>;
  const keys = Object.keys(metadata);
  if (!keys.every((key) => key === 'scope' || key === 'subresource')) return false;
  if (!keys.includes('scope') || keys.length < 1 || keys.length > 2) return false;
  if (typeof metadata.scope !== 'string' || !AUTHORIZATION_IDENTIFIER.test(metadata.scope)) {
    return false;
  }
  return (
    metadata.subresource === undefined ||
    (typeof metadata.subresource === 'string' && SUBRESOURCE_IDENTIFIER.test(metadata.subresource))
  );
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
