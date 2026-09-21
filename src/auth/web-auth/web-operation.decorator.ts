import { SetMetadata } from '@nestjs/common';
import { WebAuthorizationOperation } from './contracts/web-auth.contracts';

export const WEB_OPERATION_METADATA = Symbol('web-auth:operation');

export const WebOperation = (operation: WebAuthorizationOperation) =>
  SetMetadata(WEB_OPERATION_METADATA, operation);
