import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';
import { PvtEnvs } from 'src/config';

@Injectable()
export class HashPvtGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token no proporcionado o con formato inválido');
    }

    const token = authHeader.split(' ')[1];
    if (token !== PvtEnvs.PvtHashSecret) {
      throw new ForbiddenException('Token no válido');
    }

    return true;
  }
}
