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
      sessionAbsoluteExpiresAt: Date.now() + 120_000,
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
      sessionAbsoluteExpiresAt: expect.any(Number),
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

  it('takes sid only from its cookie and forwards the exact client ensure payload', async () => {
    const upstream = clientContextFixture();
    nats.firstValue.mockResolvedValueOnce(upstream);
    const response = await request(app.getHttpServer())
      .post('/api/auth/client/context')
      .set('Cookie', `sid=${sid}`)
      .send({ tool: 'beneficiary' })
      .expect(200);
    expect(nats.firstValue).toHaveBeenCalledWith(WebAuthPatterns.clientEnsure, {
      sid,
      tool: 'beneficiary',
    });
    expect(response.body).toEqual(upstream);
    expect(response.headers['set-cookie']).toBeUndefined();
    expectNoCache(response.headers);
  });

  it.each([
    ['missing sid', undefined],
    ['invalid sid', 'sid=invalid'],
    ['ambiguous sid', `sid=${sid}; sid=${'b'.repeat(43)}`],
  ])('rejects %s cookie without calling Auth', async (_name, cookie) => {
    const pending = request(app.getHttpServer())
      .post('/api/auth/client/context')
      .send({ tool: 'beneficiary' });
    if (cookie) pending.set('Cookie', cookie);
    const response = await pending.expect(401);
    expect(response.body.error.code).toBe('SESSION_INVALID');
    expect(nats.firstValue).not.toHaveBeenCalled();
    expect(response.headers['set-cookie']).toBeUndefined();
    expectNoCache(response.headers);
  });

  it.each([
    ['additional field', { tool: 'beneficiary', unexpected: true }],
    ['sid in body', { tool: 'beneficiary', sid }],
    ['clientId', { tool: 'beneficiary', clientId: 'beneficiary-interface' }],
    ['audience', { tool: 'beneficiary', audience: 'beneficiary-interface' }],
    ['resourceServer', { tool: 'beneficiary', resourceServer: 'beneficiary-interface' }],
    ['origin selector', { tool: 'beneficiary', origin: 'https://example.test' }],
    ['uppercase tool', { tool: 'Beneficiary' }],
    ['leading digit', { tool: '1beneficiary' }],
    ['invalid character', { tool: 'beneficiary_interface' }],
    ['too long', { tool: `b${'a'.repeat(64)}` }],
  ])('rejects client context body with %s', async (_name, body) => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/client/context')
      .set('Cookie', `sid=${sid}`)
      .send(body)
      .expect(400);
    expect(response.body.error.code).toBe('INVALID_CLIENT_REQUEST');
    expect(nats.firstValue).not.toHaveBeenCalled();
    expect(response.headers['set-cookie']).toBeUndefined();
    expectNoCache(response.headers);
  });

  it('allowlists the client context response and presentation identity', async () => {
    const expected = clientContextFixture();
    nats.firstValue.mockResolvedValueOnce({
      ...expected,
      identity: {
        ...identity,
        roles: ['must-not-leak'],
        groups: ['must-not-leak'],
      },
      sid: 'must-not-leak',
      accessToken: 'must-not-leak',
      refreshToken: 'must-not-leak',
      idToken: 'must-not-leak',
      claims: { sensitive: true },
      resourceServer: 'must-not-leak',
    });
    const response = await request(app.getHttpServer())
      .post('/api/auth/client/context')
      .set('Cookie', `sid=${sid}`)
      .send({ tool: 'beneficiary' })
      .expect(200);
    expect(response.body).toEqual(expected);
    expect(response.text).not.toContain('must-not-leak');
    expect(response.headers['set-cookie']).toBeUndefined();
    expectNoCache(response.headers);
  });

  it.each([
    ['authenticated false', { authenticated: false }],
    ['missing current client', { currentClient: undefined }],
    ['invalid identity', { identity: { name: 'Missing subject' } }],
    ['invalid realm roles', { realmRoles: ['valid', 1] }],
    ['invalid client roles', { clientRoles: 'invalid' }],
    ['invalid groups', { groups: [null] }],
    ['invalid context expiry', { contextExpiresAt: 1.5 }],
    ['non epoch context expiry', { contextExpiresAt: 60_000 }],
    ['invalid session expiry', { sessionExpiresAt: Number.NaN }],
    ['invalid absolute expiry', { sessionAbsoluteExpiresAt: undefined }],
  ])('rejects malformed client context response: %s', async (_name, patch) => {
    nats.firstValue.mockResolvedValueOnce({
      ...clientContextFixture(),
      ...patch,
    });
    const response = await request(app.getHttpServer())
      .post('/api/auth/client/context')
      .set('Cookie', `sid=${sid}`)
      .send({ tool: 'beneficiary' })
      .expect(502);
    expect(response.body.error.code).toBe('AUTH_UPSTREAM_ERROR');
    expect(response.headers['set-cookie']).toBeUndefined();
    expectNoCache(response.headers);
  });

  it.each([
    ['INVALID_CLIENT_REQUEST', 400],
    ['SESSION_INVALID', 401],
    ['WEB_TOOL_UNAVAILABLE', 403],
    ['WEB_CLIENT_ACCESS_DENIED', 403],
    ['WEB_CLIENT_INVALID', 502],
    ['AUTH_SERVICE_UNAVAILABLE', 503],
    ['WEB_AUTH_DISABLED', 503],
  ])('maps client ensure error %s to HTTP %s', async (code, status) => {
    nats.firstValue.mockRejectedValueOnce({
      error: { code, message: 'upstream detail must not leak' },
      sid: 'must-not-leak',
    });
    const response = await request(app.getHttpServer())
      .post('/api/auth/client/context')
      .set('Cookie', `sid=${sid}`)
      .send({ tool: 'beneficiary' })
      .expect(status);
    expect(response.body.error.code).toBe(code);
    expect(response.text).not.toContain('upstream detail');
    expect(response.text).not.toContain('must-not-leak');
    expect(response.headers['set-cookie']).toBeUndefined();
    expectNoCache(response.headers);
  });

  it('sanitizes an unknown client ensure error', async () => {
    nats.firstValue.mockRejectedValueOnce(new Error('internal NATS and request detail'));
    const response = await request(app.getHttpServer())
      .post('/api/auth/client/context')
      .set('Cookie', `sid=${sid}`)
      .send({ tool: 'beneficiary' })
      .expect(502);
    expect(response.body.error.code).toBe('AUTH_UPSTREAM_ERROR');
    expect(response.text).not.toContain('internal NATS');
    expect(response.headers['set-cookie']).toBeUndefined();
    expectNoCache(response.headers);
  });

  it.each([undefined, null, Number.NaN, Number.POSITIVE_INFINITY, 1.5])(
    'rejects an invalid absolute session expiry from Auth',
    async (sessionAbsoluteExpiresAt) => {
      nats.firstValue.mockResolvedValueOnce({
        sid,
        returnPath: '/apphub',
        identity,
        sessionExpiresAt: Date.now() + 60_000,
        sessionAbsoluteExpiresAt,
      });
      const response = await request(app.getHttpServer())
        .post('/api/auth/exchange')
        .send({
          code: 'authorization-code',
          state: opaque,
          browserBinding: opaque,
        })
        .expect(502);
      expect(response.body.error.code).toBe('AUTH_UPSTREAM_ERROR');
    },
  );

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

function clientContextFixture() {
  return {
    authenticated: true,
    currentTool: 'beneficiary',
    currentClient: 'beneficiary-interface',
    identity,
    realmRoles: ['realm-role'],
    clientRoles: ['read'],
    groups: ['/beneficiary'],
    contextExpiresAt: Date.now() + 60_000,
    sessionExpiresAt: Date.now() + 120_000,
    sessionAbsoluteExpiresAt: Date.now() + 240_000,
  };
}
