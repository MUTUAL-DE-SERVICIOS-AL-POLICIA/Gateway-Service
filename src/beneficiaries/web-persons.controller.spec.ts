/// <reference types="jest" />
import { HttpException, INestApplication, RequestMethod, ValidationPipe } from '@nestjs/common';
import {
  GUARDS_METADATA,
  INTERCEPTORS_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import { Observable, of, throwError, TimeoutError } from 'rxjs';
import request from 'supertest';
import { NatsService } from 'src/common/services/nats.service';
import { WebAuthorizationGuard } from 'src/auth/web-auth/web-authorization.guard';
import { WebAuthExceptionFilter } from 'src/auth/web-auth/web-auth-exception.filter';
import {
  WEB_AUTHORIZE_METADATA,
  WEB_PROTECTED_METADATA,
} from 'src/auth/web-auth/web-authorization.decorators';
import { WebPersonsController } from './web-persons.controller';

jest.mock('src/config', () => ({ NATS_SERVICE: 'NATS_SERVICE' }));

const sid = 's'.repeat(43);
const authorizationPermit = {
  authorized: true,
  actor: { sub: 'subject-1', preferredUsername: 'operator', name: 'Operator' },
};

describe('WebPersonsController', () => {
  let app: INestApplication;
  const nats = { send: jest.fn() };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [WebPersonsController],
      providers: [
        WebAuthorizationGuard,
        WebAuthExceptionFilter,
        { provide: NatsService, useValue: nats },
      ],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.use((req: any, _res: unknown, next: () => void) => {
      if (req.headers['x-test-existing-user'] === 'object')
        req.user = { username: 'existing-user' };
      if (req.headers['x-test-existing-user'] === 'primitive') req.user = 'existing-user';
      next();
    });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    await app.init();
  });

  afterAll(() => app.close());

  beforeEach(() => {
    jest.clearAllMocks();
    nats.send.mockReset();
  });

  it('declares the separate GET route, fixed UMA metadata and exclusive guard', () => {
    const handler = WebPersonsController.prototype.findAll;
    expect(Reflect.getMetadata(PATH_METADATA, WebPersonsController)).toBe(
      'web/beneficiaries/persons',
    );
    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe('/');
    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(RequestMethod.GET);
    expect(Reflect.getMetadata(WEB_AUTHORIZE_METADATA, WebPersonsController)).toEqual({
      tool: 'beneficiary',
      resource: 'persons',
    });
    expect(Reflect.getMetadata(WEB_PROTECTED_METADATA, handler)).toEqual({ scope: 'read' });
    expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toEqual([WebAuthorizationGuard]);
    expect(Reflect.getMetadata(INTERCEPTORS_METADATA, handler)).toBeUndefined();
    expect(Reflect.getMetadata(INTERCEPTORS_METADATA, WebPersonsController)).toBeUndefined();
  });

  it('authorizes with fixed metadata and transparently returns person.findAll', async () => {
    const result = { data: [{ id: 1 }], meta: { total: 1 } };
    nats.send.mockResolvedValueOnce(of(authorizationPermit)).mockResolvedValueOnce(of(result));
    const response = await request(app.getHttpServer())
      .get('/api/web/beneficiaries/persons')
      .set('Cookie', `sid=${sid}`)
      .query({
        page: 2,
        limit: 10,
        filter: 'sample',
        orderBy: 'lastName',
        order: 'ASC',
      })
      .expect(200);

    expect(nats.send).toHaveBeenNthCalledWith(1, 'web-auth.authorization.check', {
      sid,
      tool: 'beneficiary',
      resource: 'persons',
      scope: 'read',
    });
    expect(nats.send).toHaveBeenNthCalledWith(2, 'person.findAll', {
      page: 2,
      limit: 10,
      filter: 'sample',
      orderBy: 'lastName',
      order: 'ASC',
    });
    expect(response.body).toEqual(result);
    expect(JSON.stringify(nats.send.mock.calls[1][1])).not.toMatch(
      /sid|token|identity|authorization/i,
    );
    expectNoCacheOrCookie(response);
  });

  it('applies its localized filter to a denial thrown by the guard', async () => {
    nats.send.mockResolvedValueOnce(of({ authorized: false }));
    const response = await request(app.getHttpServer())
      .get('/api/web/beneficiaries/persons')
      .set('Cookie', `sid=${sid}`)
      .expect(403);
    expect(response.body).toEqual({
      error: {
        code: 'AUTHORIZATION_DENIED',
        message: 'Authorization denied',
      },
    });
    expectNoCacheOrCookie(response);
    expect(nats.send).toHaveBeenCalledTimes(1);
  });

  it.each(['object', 'primitive'])(
    'sanitizes a preexisting %s authorization context without calling NATS',
    async (kind) => {
      const response = await request(app.getHttpServer())
        .get('/api/web/beneficiaries/persons')
        .set('Cookie', `sid=${sid}`)
        .set('x-test-existing-user', kind)
        .expect(500);
      expect(response.body).toEqual({
        error: {
          code: 'AUTHORIZATION_CONTEXT_INVALID',
          message: 'Authorization context is invalid',
        },
      });
      expect(response.text).not.toContain('existing-user');
      expect(nats.send).not.toHaveBeenCalled();
      expectNoCacheOrCookie(response);
    },
  );

  it('maps an unknown asynchronous error safely to 502', async () => {
    nats.send
      .mockResolvedValueOnce(of(authorizationPermit))
      .mockResolvedValueOnce(throwError(() => new Error('NATS connection and payload detail')));
    const response = await request(app.getHttpServer())
      .get('/api/web/beneficiaries/persons')
      .set('Cookie', `sid=${sid}`)
      .expect(502);
    expect(response.body.error.code).toBe('AUTH_UPSTREAM_ERROR');
    expect(response.text).not.toContain('NATS connection');
    expectNoCacheOrCookie(response);
  });

  it('does not trust a remote status, code or message', async () => {
    nats.send.mockResolvedValueOnce(of(authorizationPermit)).mockResolvedValueOnce(
      throwError(
        () =>
          new HttpException(
            {
              statusCode: 503,
              code: 'AUTH_SERVICE_UNAVAILABLE',
              message: 'remote-controlled detail',
            },
            503,
          ),
      ),
    );
    const response = await request(app.getHttpServer())
      .get('/api/web/beneficiaries/persons')
      .set('Cookie', `sid=${sid}`)
      .expect(502);
    expect(response.body.error.code).toBe('AUTH_UPSTREAM_ERROR');
    expect(response.text).not.toContain('remote-controlled');
    expectNoCacheOrCookie(response);
  });

  it.each([
    new HttpException('Microservice Unavailable', 503),
    new HttpException({ code: '503' }, 503),
  ])('maps transport-looking errors with lost provenance safely to 502', async (remoteError) => {
    nats.send
      .mockResolvedValueOnce(of(authorizationPermit))
      .mockResolvedValueOnce(throwError(() => remoteError));
    const response = await request(app.getHttpServer())
      .get('/api/web/beneficiaries/persons')
      .set('Cookie', `sid=${sid}`)
      .expect(502);
    expect(response.body.error.code).toBe('AUTH_UPSTREAM_ERROR');
    expectNoCacheOrCookie(response);
  });

  it('cancels the person.findAll subscription on its local timeout', async () => {
    jest.useFakeTimers();
    const teardown = jest.fn();
    const localNats = {
      send: jest.fn().mockResolvedValueOnce(new Observable(() => teardown)),
    };
    const controller = new WebPersonsController(localNats as unknown as NatsService);
    const pending = controller.findAll({}).catch((error) => error);
    await jest.advanceTimersByTimeAsync(10_000);
    const error = (await pending) as HttpException;
    expect(error.getStatus()).toBe(503);
    expect((error.getResponse() as { error: { code: string } }).error.code).toBe(
      'BENEFICIARY_SERVICE_UNAVAILABLE',
    );
    expect(teardown).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
    jest.useRealTimers();
  });

  it('maps a local timeout to HTTP 503 without cache or cookies', async () => {
    nats.send
      .mockResolvedValueOnce(of(authorizationPermit))
      .mockResolvedValueOnce(throwError(() => new TimeoutError()));
    const response = await request(app.getHttpServer())
      .get('/api/web/beneficiaries/persons')
      .set('Cookie', `sid=${sid}`)
      .expect(503);
    expect(response.body.error.code).toBe('BENEFICIARY_SERVICE_UNAVAILABLE');
    expectNoCacheOrCookie(response);
  });

  it('rejects unknown query fields before forwarding to Beneficiary-Service', async () => {
    nats.send.mockResolvedValueOnce(of(authorizationPermit));
    const response = await request(app.getHttpServer())
      .get('/api/web/beneficiaries/persons')
      .set('Cookie', `sid=${sid}`)
      .query({ sid, operation: 'beneficiary.persons.read' })
      .expect(400);
    expect(response.body.error.code).toBe('INVALID_AUTHORIZATION_REQUEST');
    expect(nats.send).toHaveBeenCalledTimes(1);
  });
});

function expectNoCacheOrCookie(response: {
  headers: Record<string, string | string[] | undefined>;
}): void {
  expect(response.headers['cache-control']).toBe('no-store');
  expect(response.headers.pragma).toBe('no-cache');
  expect(response.headers['set-cookie']).toBeUndefined();
}
