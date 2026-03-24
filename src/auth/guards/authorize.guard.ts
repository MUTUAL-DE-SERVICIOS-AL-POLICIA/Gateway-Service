// src/auth/guards/authorize.guard.ts
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { NatsService } from 'src/common';
import { AUTHORIZE_KEY, AuthorizeMeta } from '../decorators/authorize.decorator';
import { PROTECTED_KEY, ProtectedMeta } from '../decorators/protected.decorator';

@Injectable()
export class AuthorizeGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly nats: NatsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const sid = req.cookies?.sid || (req.headers['x-session-id'] as string);
    const origin = (req.headers['origin'] || req.headers['x-origin']) as string;

    // ── 1. Verificar token (siempre) ─────────────────────────────────────
    if (!sid) throw new UnauthorizedException('sid no encontrado');

    let tokenResult: any;
    try {
      tokenResult = await this.nats.firstValue('auth.token.verify', { sid, origin });
    } catch {
      throw new UnauthorizedException('No se pudo verificar el token');
    }

    if (!tokenResult?.exists) throw new UnauthorizedException('No existe token para esta sesión');
    if (!tokenResult?.isValid) throw new UnauthorizedException('Token inválido o expirado');

    // ── 2. Evaluar permiso (solo si el endpoint tiene @Protected) ─────────
    const protectedMeta = this.reflector.get<ProtectedMeta | undefined>(
      PROTECTED_KEY,
      context.getHandler(),
    );
    if (!protectedMeta) return true;

    const authorizeMeta = this.reflector.get<AuthorizeMeta>(
      AUTHORIZE_KEY,
      context.getClass(),
    );

    const resource = protectedMeta.subresource
      ? `${authorizeMeta.resource}.${protectedMeta.subresource}`
      : authorizeMeta.resource;

    let permResult: any;
    try {
      permResult = await this.nats.firstValue('auth.permission.evaluate', {
        sid,
        origin,
        audience: authorizeMeta.audience,
        resource,
        scope: protectedMeta.scope,
      });
    } catch {
      throw new ForbiddenException('No se pudo evaluar el permiso');
    }

    if (!permResult?.ok)     throw new ForbiddenException('No se pudo evaluar el permiso');
    if (!permResult.granted) throw new ForbiddenException('Acceso denegado');

    return true;
  }
}