import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { NatsService } from 'src/common';

@Injectable()
export class AuthBcbGuard implements CanActivate {
  private readonly logger = new Logger('AuthBcbGuard');

  constructor(
    private readonly nats: NatsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {

    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);
    try {
      const decoded = await this.nats.firstValue('authBcb.verifyJwt', token!);
      request.user = decoded;
      return true;
    } catch {
      throw new UnauthorizedException({ error: true, message: 'Sin autorización' });
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
