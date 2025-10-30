import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { Reflector } from '@nestjs/core';
import { NatsService, RecordService } from 'src/common';

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger('AuthGuard');

  constructor(
    private readonly nats: NatsService,
    private readonly recordService: RecordService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'] as string | undefined;
    const token = this.extractTokenFromHeader(request);

    if (!apiKey && !token) {
      throw new NotFoundException({ error: true, message: 'Token no encontrado' });
    }

    try {
      if (apiKey) {
        return await this.nats.firstValue('auth.verify.apikey', apiKey);
      }

      const { username, name } = await this.nats.firstValue('auth.verify.token', token!);
      request.user = { username, name };
      return true;
    } catch (err) {
      this.recordService.warn({
        ip: request.ip,
        message: apiKey ? 'Api Key inválida' : 'Token inválido',
      });
      throw new UnauthorizedException({ error: true, message: 'Sin autorización' });
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
