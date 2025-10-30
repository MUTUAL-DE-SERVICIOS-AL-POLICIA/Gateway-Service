import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { NatsService } from 'src/common';

@Injectable()
export class AuthAppMobileGuard implements CanActivate {
  private readonly logger = new Logger('AuthAppMobileGuard');
  constructor(
    private nats: NatsService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Envíe un token de autorización');
    }

    const apiToken = authHeader.split(' ')[1];

    const response = await this.nats.firstValue('auth.verifyApiTokenAppMobile', { apiToken });

    const { error, message } = response;

    if (error) {
      throw new UnauthorizedException({ error: true, message: 'Sin autorización, ' + message });
    }
    const user = {
      personId: response.personId,
      fullname: response.fullname,
      affiliateId: response.affiliateId,
      tokenId: response.tokenId,
    };

    request.user = user;

    return true;
  }
}
