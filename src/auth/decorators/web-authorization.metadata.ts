export interface WebControllerMetadata {
  readonly tool: string;
  readonly resource: string;
}

export interface WebPermissionMetadata {
  readonly scope: string;
  readonly subresource?: string;
}

export const WEB_CONTROLLER_METADATA = Symbol('web-auth:controller');
export const WEB_PERMISSION_METADATA = Symbol('web-auth:permission');
export const WEB_SESSION_ONLY_METADATA = Symbol('web-auth:session-only');
