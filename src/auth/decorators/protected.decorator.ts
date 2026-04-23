// src/auth/decorators/protected.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const PROTECTED_KEY = 'protected_meta';

export interface ProtectedMeta {
  scope: string;
  subresource?: string;
}

export function Protected(scope: string, subresource?: string) {
  return SetMetadata(PROTECTED_KEY, { scope, subresource });
}