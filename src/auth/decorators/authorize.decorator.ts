// src/auth/decorators/authorize.decorator.ts
import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { AuthorizeGuard } from '../guards/authorize.guard';

export const AUTHORIZE_KEY = 'authorize_meta';

export interface AuthorizeMeta {
  audience: string;
  resource: string;
}

export function Authorize(audience: string, resource: string) {
  return applyDecorators(
    SetMetadata(AUTHORIZE_KEY, { audience, resource }),
    UseGuards(AuthorizeGuard),
  );
}