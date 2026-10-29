import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { ApiCookieAuth } from '@nestjs/swagger';
import { WebAuthorizationGuard } from '../guards/web-authorization.guard';
import {
  WEB_CONTROLLER_METADATA,
  WEB_PERMISSION_METADATA,
  WEB_SHARED_SESSION_METADATA,
  WEB_SESSION_ONLY_METADATA,
} from './web-authorization.metadata';

export const WebController = (tool: string, resource: string) =>
  applyDecorators(
    SetMetadata(WEB_CONTROLLER_METADATA, Object.freeze({ tool, resource })),
    UseGuards(WebAuthorizationGuard),
    ApiCookieAuth('web-session'),
  );

export const WebPermission = (scope: string, subresource?: string) =>
  SetMetadata(
    WEB_PERMISSION_METADATA,
    Object.freeze(subresource === undefined ? { scope } : { scope, subresource }),
  );

export const WebSessionOnly = () => SetMetadata(WEB_SESSION_ONLY_METADATA, true);

export const WebSharedSession = () =>
  applyDecorators(
    SetMetadata(WEB_SHARED_SESSION_METADATA, true),
    UseGuards(WebAuthorizationGuard),
    ApiCookieAuth('web-session'),
  );
