/// <reference types="jest" />
import {
  CallHandler,
  Controller,
  ExecutionContext,
  Get,
  INestApplication,
  Injectable,
  NestInterceptor,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { Observable, of, tap, throwError } from 'rxjs';
import request from 'supertest';
import { WebAuthorizationGuard } from 'src/auth/web-auth/web-authorization.guard';
import { WebAuthorize, WebProtected } from 'src/auth/web-auth/web-authorization.decorators';
import { WebAuthPatterns } from 'src/auth/web-auth/contracts/web-auth.contracts';
import { NatsService } from 'src/common/services/nats.service';

jest.mock('src/config', () => ({ NATS_SERVICE: 'NATS_SERVICE' }));

const sid = 's'.repeat(43);

@Injectable()
class AuditProbeInterceptor implements NestInterceptor {
  readonly intercept = jest.fn((_context: ExecutionContext, next: CallHandler) =>
    next.handle().pipe(tap(() => this.emit())),
  );
  readonly emit = jest.fn();
}

@Controller('authorization-pipeline')
@UseGuards(WebAuthorizationGuard)
@UseInterceptors(AuditProbeInterceptor)
@WebAuthorize('beneficiary', 'persons')
@WebProtected('read')
class AuthorizationPipelineController {
  readonly handled = jest.fn(() => ({ ok: true }));

  @Get()
  handle() {
    return this.handled();
  }

  @Get('preexisting-user')
  handlePreexistingUser() {
    return this.handled();
  }
}

describe('Web authorization HTTP pipeline', () => {
  let app: INestApplication;
  let controller: AuthorizationPipelineController;
  let audit: AuditProbeInterceptor;
  const nats = { send: jest.fn() };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AuthorizationPipelineController],
      providers: [
        Reflector,
        WebAuthorizationGuard,
        AuditProbeInterceptor,
        { provide: NatsService, useValue: nats },
      ],
    }).compile();
    controller = module.get(AuthorizationPipelineController);
    audit = module.get(AuditProbeInterceptor);
    app = module.createNestApplication();
    app.use((req: any, _res: unknown, next: () => void) => {
      if (req.url.endsWith('/preexisting-user')) req.user = { existing: true };
      next();
    });
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(() => app?.close());

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function expectSafeError(
    response: request.Response,
    status: number,
    code: string,
    message: string,
  ) {
    expect(response.status).toBe(status);
    expect(response.body).toEqual({ error: { code, message } });
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers.pragma).toBe('no-cache');
    expect(response.headers['set-cookie']).toBeUndefined();
    expect(JSON.stringify(response.body)).not.toMatch(
      /sid|cookie|actor|metadata|payload|cause|stack/i,
    );
    expect(controller.handled).not.toHaveBeenCalled();
    expect(audit.intercept).not.toHaveBeenCalled();
    expect(audit.emit).not.toHaveBeenCalled();
  }

  it('publishes an invalid SID as SESSION_INVALID', async () => {
    const response = await request(app.getHttpServer()).get('/api/authorization-pipeline');
    expectSafeError(response, 401, 'SESSION_INVALID', 'Session is invalid or expired');
    expect(nats.send).not.toHaveBeenCalled();
  });

  it.each([
    [
      'denied',
      () => of({ authorized: false }),
      403,
      'AUTHORIZATION_DENIED',
      'Authorization denied',
    ],
    [
      'Auth unavailable',
      () => throwError(() => ({ error: { code: 'AUTH_SERVICE_UNAVAILABLE' } })),
      503,
      'AUTH_SERVICE_UNAVAILABLE',
      'Authentication service is unavailable',
    ],
    [
      'web auth disabled',
      () => throwError(() => ({ error: { code: 'WEB_AUTH_DISABLED' } })),
      503,
      'WEB_AUTH_DISABLED',
      'Web authentication is disabled',
    ],
    [
      'malformed upstream response',
      () => of({ unexpected: true }),
      502,
      'AUTH_UPSTREAM_ERROR',
      'Authentication request failed',
    ],
  ])('publishes a safe %s response', async (_label, source, status, code, message) => {
    nats.send.mockResolvedValueOnce(source());
    const response = await request(app.getHttpServer())
      .get('/api/authorization-pipeline')
      .set('Cookie', `sid=${sid}`);
    expectSafeError(response, status, code, message);
    expect(nats.send).toHaveBeenCalledTimes(1);
  });

  it('fails closed when request.user already exists', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/authorization-pipeline/preexisting-user')
      .set('Cookie', `sid=${sid}`);
    expectSafeError(
      response,
      500,
      'AUTHORIZATION_CONTEXT_INVALID',
      'Authorization context is invalid',
    );
    expect(nats.send).not.toHaveBeenCalled();
  });

  it('executes the interceptor and handler only after real authorization', async () => {
    nats.send.mockResolvedValueOnce(
      of({ authorized: true, actor: { sub: 'subject', preferredUsername: 'operator' } }),
    );
    const response = await request(app.getHttpServer())
      .get('/api/authorization-pipeline')
      .set('Cookie', `sid=${sid}`)
      .expect(200);
    expect(response.body).toEqual({ ok: true });
    expect(nats.send).toHaveBeenCalledWith(WebAuthPatterns.authorizationCheck, {
      sid,
      tool: 'beneficiary',
      resource: 'persons',
      scope: 'read',
    });
    expect(controller.handled).toHaveBeenCalledTimes(1);
    expect(audit.intercept).toHaveBeenCalledTimes(1);
    expect(audit.emit).toHaveBeenCalledTimes(1);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers.pragma).toBe('no-cache');
    expect(response.headers['set-cookie']).toBeUndefined();
  });
});
