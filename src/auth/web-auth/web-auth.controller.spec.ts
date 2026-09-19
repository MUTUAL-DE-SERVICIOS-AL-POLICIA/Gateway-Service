/// <reference types="jest" />
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { NatsService } from 'src/common/services/nats.service';
import { WebAuthPatterns } from './contracts/web-auth.contracts';
import { WebAuthController } from './web-auth.controller';
import { WebAuthExceptionFilter } from './web-auth-exception.filter';

jest.mock('src/config', () => ({ NATS_SERVICE: 'NATS_SERVICE' }));

const opaque = 'a'.repeat(43);
const sid = 's'.repeat(43);
const identity = {
  sub: 'person-1',
  preferredUsername: 'person',
  name: 'Test Person',
};

describe('WebAuthController', () => {
  let app: INestApplication;
  const nats = { firstValue: jest.fn() };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [WebAuthController],
      providers: [WebAuthExceptionFilter, { provide: NatsService, useValue: nats }],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    await app.init();
  });

  afterAll(() => app.close());

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('forwards login/start and returns only the authorization URL without cookies', async () => {
    nats.firstValue.mockResolvedValueOnce({
      authorizationUrl: `https://id.test/authorize?state=${opaque}`,
      access_token: 'must-not-leak',
    });
    const response = await request(app.getHttpServer())
      .post('/api/auth/login/start')
      .send({ returnPath: '/apphub', browserBinding: opaque })
      .expect(200);
    expect(nats.firstValue).toHaveBeenCalledWith(WebAuthPatterns.loginStart, {
      returnPath: '/apphub',
      browserBinding: opaque,
    });
    expect(response.body).toEqual({
      authorizationUrl: `https://id.test/authorize?state=${opaque}`,
    });
    expect(response.text).not.toContain('must-not-leak');
    expect(response.headers['set-cookie']).toBeUndefined();
    expectNoCache(response.headers);
  });

  it('rejects invalid DTOs and extra fields with a public response', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login/start')
      .send({
        returnPath: 'https://evil.test/apphub',
        browserBinding: opaque,
        unexpected: 'value',
      })
      .expect(400);
    expect(response.body).toEqual({
      error: {
        code: 'INVALID_LOGIN_REQUEST',
        message: 'Invalid login request',
      },
    });
    expect(nats.firstValue).not.toHaveBeenCalled();
    expectNoCache(response.headers);
  });

  it('forwards exchange and allowlists its response', async () => {
    nats.firstValue.mockResolvedValueOnce({
      sid,
      returnPath: '/apphub/reports?page=2',
      identity: {
        ...identity,
        roles: ['must-not-leak'],
        groups: ['must-not-leak'],
      },
      sessionExpiresAt: Date.now() + 60_000,
      refreshToken: 'must-not-leak',
    });
    const response = await request(app.getHttpServer())
      .post('/api/auth/exchange')
      .send({ code: 'authorization-code', state: opaque, browserBinding: opaque })
      .expect(200);
    expect(nats.firstValue).toHaveBeenCalledWith(WebAuthPatterns.loginExchange, {
      code: 'authorization-code',
      state: opaque,
      browserBinding: opaque,
    });
    expect(response.body).toEqual({
      sid,
      returnPath: '/apphub/reports?page=2',
      identity,
      sessionExpiresAt: expect.any(Number),
    });
    expect(response.text).not.toContain('must-not-leak');
    expect(response.headers['set-cookie']).toBeUndefined();
    expectNoCache(response.headers);
  });

  it('forwards session/check and never reflects stored tokens', async () => {
    nats.firstValue.mockResolvedValueOnce({
      authenticated: true,
      identity,
      sessionExpiresAt: Date.now() + 60_000,
      hubTokens: { accessToken: 'must-not-leak' },
    });
    const response = await request(app.getHttpServer())
      .post('/api/auth/session/check')
      .send({ sid })
      .expect(200);
    expect(nats.firstValue).toHaveBeenCalledWith(WebAuthPatterns.sessionCheck, {
      sid,
    });
    expect(response.body).toEqual({
      authenticated: true,
      identity,
      sessionExpiresAt: expect.any(Number),
    });
    expect(response.text).not.toContain('must-not-leak');
    expect(response.headers['set-cookie']).toBeUndefined();
    expectNoCache(response.headers);
  });

  it.each([
    ['INVALID_LOGIN_REQUEST', 400],
    ['LOGIN_STATE_INVALID', 401],
    ['SESSION_INVALID', 401],
    ['WEB_AUTH_DISABLED', 503],
    ['AUTH_SERVICE_UNAVAILABLE', 503],
    ['OIDC_LOGIN_FAILED', 502],
  ])('maps %s to HTTP %s without reflecting upstream details', async (code, status) => {
    nats.firstValue.mockRejectedValueOnce({
      error: { code, message: 'internal detail must not leak' },
      stack: 'must not leak',
    });
    const response = await request(app.getHttpServer())
      .post('/api/auth/session/check')
      .send({ sid })
      .expect(status);
    expect(response.body.error.code).toBe(code);
    expect(response.text).not.toContain('internal detail');
    expect(response.text).not.toContain('stack');
    expectNoCache(response.headers);
  });

  it('sanitizes an unknown NATS error', async () => {
    nats.firstValue.mockRejectedValueOnce(new Error('internal connection and payload detail'));
    const response = await request(app.getHttpServer())
      .post('/api/auth/session/check')
      .send({ sid })
      .expect(502);
    expect(response.body).toEqual({
      error: {
        code: 'AUTH_UPSTREAM_ERROR',
        message: 'Authentication request failed',
      },
    });
    expect(response.text).not.toContain('internal connection');
  });

  it.each([
    { authorizationUrl: 'not-a-url' },
    { authorizationUrl: 'https://id.test/auth?access_token=secret' },
    { authorizationUrl: `https://id.test/auth?state=${opaque}`, extra: true },
  ])('rejects a malformed or sensitive Auth response', async (upstream) => {
    nats.firstValue.mockResolvedValueOnce(upstream);
    const response = await request(app.getHttpServer())
      .post('/api/auth/login/start')
      .send({ returnPath: '/apphub', browserBinding: opaque })
      .expect(upstream.extra ? 200 : 502);
    if (upstream.extra) {
      expect(response.body).not.toHaveProperty('extra');
    } else {
      expect(response.body.error.code).toBe('AUTH_UPSTREAM_ERROR');
      expect(response.text).not.toContain('secret');
    }
  });
});

function expectNoCache(headers: Record<string, string | string[]>): void {
  expect(headers['cache-control']).toBe('no-store');
  expect(headers.pragma).toBe('no-cache');
}
