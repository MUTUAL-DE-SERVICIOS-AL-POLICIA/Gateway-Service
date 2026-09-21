import { SetMetadata } from '@nestjs/common';

export interface WebAuthorizeMetadata {
  readonly tool: string;
  readonly resource: string;
}

export interface WebProtectedMetadata {
  readonly scope: string;
}

export const WEB_AUTHORIZE_METADATA = Symbol('web-auth:authorize');
export const WEB_PROTECTED_METADATA = Symbol('web-auth:protected');

export const WebAuthorize = (tool: string, resource: string) =>
  SetMetadata(WEB_AUTHORIZE_METADATA, Object.freeze({ tool, resource }));

export const WebProtected = (scope: string) =>
  SetMetadata(WEB_PROTECTED_METADATA, Object.freeze({ scope }));
