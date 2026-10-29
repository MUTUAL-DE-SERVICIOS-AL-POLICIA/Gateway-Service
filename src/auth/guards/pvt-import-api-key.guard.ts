import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import { Request } from 'express';
import { PvtImportEnvs } from 'src/config';

@Injectable()
export class PvtImportApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const candidate = request.headers['x-api-key'];
    if (typeof candidate !== 'string' || !this.matches(candidate, PvtImportEnvs.apiKey)) {
      throw new UnauthorizedException({
        error: true,
        message: 'Sin autorización',
      });
    }
    return true;
  }

  private matches(candidate: string, expected: string): boolean {
    const actualBuffer = Buffer.from(candidate);
    const expectedBuffer = Buffer.from(expected);
    return (
      actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer)
    );
  }
}
