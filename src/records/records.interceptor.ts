import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, tap, catchError } from 'rxjs';
import { NatsService } from 'src/common';
import { Reflector } from '@nestjs/core';
import 'reflect-metadata';

@Injectable()
export class Records implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    public readonly nats: NatsService,
  ) {}

  public truncate(value: string, maxLength: number): string {
    return value.length > maxLength ? value.slice(0, maxLength) + '...' : value;
  }

  public isBase64(str: string): boolean {
    return !!str && str.length % 4 === 0 && str.length >= 16 && /^[A-Za-z0-9+/]+={0,2}$/.test(str);
  }

  public isWSQ(str: string): boolean {
    try {
      const buf = Buffer.from(str, 'base64');
      return buf.length > 2 && buf[0] === 0xff && buf[1] === 0xa0; // WSQ header
    } catch {
      return false;
    }
  }

  public sanitizeMetadata(
    metadata: Record<string, any>,
    maxLength = 50,
    excludeKeys: string[] = ['message'],
    sensitiveKeys: string[] = ['password', 'pass', 'wsqFingerprints', 'attachments'],
    neverTruncate = ['affiliateId', 'username', 'tokenId'],
  ): Record<string, any> {
    const result: Record<string, any> = {};

    for (const key in metadata) {
      const value = metadata[key];

      if (sensitiveKeys.includes(key)) {
        result[key] = '**********';
        continue;
      }

      if (excludeKeys.includes(key)) {
        result[key] = value;
        continue;
      }

      if (typeof value === 'string') {

        if (neverTruncate.includes(key)) {
          result[key] = value;
          continue;
        }

        if (this.isBase64(value) && value.length >= 16) {
          result[key] = this.isWSQ(value) ? `<len:${value.length}>` : `<len:${value.length}>`;
          continue;
        }

        result[key] = this.truncate(value, maxLength);
      } else if (Array.isArray(value)) {
        const maxShow = 10;

        if (value.length > maxShow) {
          result[key] = `<len:${value.length}>`;
        } else {
          result[key] = value;
        }
      } else if (Buffer.isBuffer(value)) {
        result[key] = `<len:${value.length}>`;
      } else if (typeof value === 'object' && value !== null) {
        try {
          result[key] = this.sanitizeMetadata(value, maxLength, excludeKeys, sensitiveKeys);
        } catch {
          result[key] = '<N/A>';
        }
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest?.() ?? {};
    const { method, user = {}, params = {}, query = {} } = request;

    const ignoredMethods = ['GET'];
    if (ignoredMethods.includes(method.toUpperCase())) {
      return next.handle();
    }

    const isPublic = this.reflector.get<boolean>('isPublic', context.getHandler());
    if (isPublic) {
      return next.handle();
    }

    const fullPath =
      (Reflect as any).getMetadata('path', context.getClass()) || context.getClass().name;

    const controllerPath = fullPath.split('/')[0];
    const handler = context.getHandler();
    const controller = context.getClass();
    const actionName = `${method}: ${controller.name}.${handler.name}`;

    let outputMetadata: Record<string, any> = {};

    return next.handle().pipe(
      tap((response) => {
        const body = request.body || {};
        const inputMetadata: Record<string, any> = {
          ...(Object.keys(body).length && this.sanitizeMetadata(body)),
          ...(Object.keys(params).length && { params: this.sanitizeMetadata(params) }),
          ...(Object.keys(query).length && { query: this.sanitizeMetadata(query) }),
          ...(Object.keys(user).length && { user: this.sanitizeMetadata(user) }),
        };

        outputMetadata = this.sanitizeMetadata(response || {});

        void this.nats.emit(`${controllerPath}.record.create`, {
          action: actionName,
          input: inputMetadata,
          output: outputMetadata,
        });
      }),
      catchError((err) => {
        outputMetadata = { error: err?.message || 'Unexpected error' };
        throw err;
      }),
    );
  }
}
