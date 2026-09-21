/// <reference types="jest" />
import { ExecutionContext, HttpException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, of, throwError } from 'rxjs';
import { NatsService } from 'src/common/services/nats.service';
import { WebAuthPatterns } from './contracts/web-auth.contracts';
import {
  WEB_AUTHORIZE_METADATA,
  WEB_PROTECTED_METADATA,
  WebAuthorize,
  WebProtected,
} from './web-authorization.decorators';
import { WebAuthorizationGuard } from './web-authorization.guard';

jest.mock('src/config', () => ({ NATS_SERVICE: 'NATS_SERVICE' }));

const sid = 's'.repeat(43);
const actor = { sub: 'subject-1', preferredUsername: 'operator', name: 'Operator' };

interface TestRequest {
  headers: { cookie?: string };
  user?: { username: string; name?: string };
}

function context(
  request: Record<string, any>,
  handler: Function = function handler() {},
  controller: Function = class Controller {},
  response: Record<string, any> = { setHeader: jest.fn() },
): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => controller,
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
  } as unknown as ExecutionContext;
}

describe('WebAuthorizationGuard', () => {
  const nats = { send: jest.fn() };
  const reflector = { getAllAndOverride: jest.fn() };
  let guard: WebAuthorizationGuard;

  beforeEach(() => {
    jest.clearAllMocks();
    nats.send.mockReset();
    reflector.getAllAndOverride.mockReset();
    reflector.getAllAndOverride
      .mockReturnValueOnce({ tool: 'beneficiary', resource: 'persons' })
      .mockReturnValueOnce({ scope: 'read' });
    guard = new WebAuthorizationGuard(
      nats as unknown as NatsService,
      reflector as unknown as Reflector,
    );
  });

  it('sends only SID and trusted metadata and installs the minimum audit actor', async () => {
    nats.send.mockResolvedValueOnce(of({ authorized: true, actor }));
    const request: TestRequest = { headers: { cookie: `sid=${sid}` } };
    await expect(guard.canActivate(context(request))).resolves.toBe(true);
    expect(nats.send).toHaveBeenCalledWith(WebAuthPatterns.authorizationCheck, {
      sid,
      tool: 'beneficiary',
      resource: 'persons',
      scope: 'read',
    });
    expect(request).toEqual({
      headers: { cookie: `sid=${sid}` },
      user: { username: 'operator', name: 'Operator' },
    });
    expect(JSON.stringify(request.user)).not.toMatch(/sid|token|roles|groups/);
  });

  it('sets no-store headers before authorization without emitting cookies', async () => {
    nats.send.mockResolvedValueOnce(of({ authorized: false }));
    const response = { setHeader: jest.fn() };
    await guard
      .canActivate(context({ headers: { cookie: `sid=${sid}` } }, undefined, undefined, response))
      .catch(() => undefined);
    expect(response.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(response.setHeader).toHaveBeenCalledWith('Pragma', 'no-cache');
    expect(response.setHeader).not.toHaveBeenCalledWith('Set-Cookie', expect.anything());
  });

  it('uses sub when preferredUsername is absent', async () => {
    nats.send.mockResolvedValueOnce(of({ authorized: true, actor: { sub: 'subject-1' } }));
    const request: TestRequest = { headers: { cookie: `sid=${sid}` } };
    await guard.canActivate(context(request));
    expect(request.user).toEqual({ username: 'subject-1', name: undefined });
  });

  it.each([
    ['missing authorize metadata', undefined, { scope: 'read' }],
    ['missing protected metadata', { tool: 'beneficiary', resource: 'persons' }, undefined],
    ['incomplete authorize metadata', { tool: 'beneficiary' }, { scope: 'read' }],
    [
      'additional authorize metadata',
      { tool: 'beneficiary', resource: 'persons', audience: 'x' },
      { scope: 'read' },
    ],
    ['invalid tool', { tool: 'Beneficiary', resource: 'persons' }, { scope: 'read' }],
    ['invalid resource', { tool: 'beneficiary', resource: 'persons#read' }, { scope: 'read' }],
    ['invalid scope', { tool: 'beneficiary', resource: 'persons' }, { scope: 'read write' }],
    [
      'partial resource override in protected metadata',
      { tool: 'beneficiary', resource: 'persons' },
      { scope: 'read', resource: 'persons.records' },
    ],
    [
      'non-plain metadata',
      Object.assign(Object.create({ tool: 'beneficiary' }), { resource: 'persons' }),
      { scope: 'read' },
    ],
  ])('fails closed for %s', async (_label, authorize, protectedMetadata) => {
    reflector.getAllAndOverride.mockReset();
    reflector.getAllAndOverride
      .mockReturnValueOnce(authorize)
      .mockReturnValueOnce(protectedMetadata);
    await expect(
      guard.canActivate(context({ headers: { cookie: `sid=${sid}` } })),
    ).rejects.toMatchObject({ status: 400 });
    expect(nats.send).not.toHaveBeenCalled();
  });

  it.each([
    ['object', { username: 'traditional-user', name: 'Traditional User' }],
    ['primitive', 'unexpected-user'],
  ])('fails closed without NATS when request.user already contains an %s', async (_label, user) => {
    const request: Record<string, unknown> = {
      headers: { cookie: `sid=${sid}` },
      user,
    };
    const original = request.user;
    const error = await guard.canActivate(context(request)).catch((value) => value);
    expect(error).toBeInstanceOf(HttpException);
    expect(error).toMatchObject({ status: 500 });
    expect(error.getResponse()).toEqual({
      error: {
        code: 'AUTHORIZATION_CONTEXT_INVALID',
        message: 'Authorization context is invalid',
      },
    });
    expect(nats.send).not.toHaveBeenCalled();
    expect(request.user).toBe(original);
  });

  it.each([
    ['missing', undefined],
    ['empty', 'sid='],
    ['invalid', 'sid=invalid'],
    ['duplicated', `sid=${sid}; sid=${'b'.repeat(43)}`],
    ['similarly named', `sid_extra=${sid}`],
    ['encoded', `sid=${encodeURIComponent(sid + '%')}`],
    ['space in name', `sid =${sid}`],
    ['space in value', `sid= ${sid}`],
  ])('rejects a %s SID cookie', async (_label, cookie) => {
    const request = { headers: cookie ? { cookie } : {} };
    const error = await guard.canActivate(context(request)).catch((value) => value);
    expect(error).toBeInstanceOf(HttpException);
    expect(error).toMatchObject({ status: 401 });
    expect(nats.send).not.toHaveBeenCalled();
  });

  it('maps authorized=false to a stable denial without setting request.user', async () => {
    nats.send.mockResolvedValueOnce(of({ authorized: false }));
    const request: TestRequest = { headers: { cookie: `sid=${sid}` } };
    const error = await guard.canActivate(context(request)).catch((value) => value);
    expect(error).toMatchObject({ status: 403 });
    expect(error.getResponse().error.code).toBe('AUTHORIZATION_DENIED');
    expect(request.user).toBeUndefined();
  });

  it.each([
    ['SESSION_INVALID', 401],
    ['INVALID_AUTHORIZATION_REQUEST', 400],
    ['AUTH_SERVICE_UNAVAILABLE', 503],
    ['WEB_AUTH_DISABLED', 503],
  ])('maps Auth error %s to HTTP %s', async (code, status) => {
    nats.send.mockResolvedValueOnce(throwError(() => ({ error: { code, detail: 'hidden' } })));
    await expect(
      guard.canActivate(context({ headers: { cookie: `sid=${sid}` } })),
    ).rejects.toMatchObject({ status });
  });

  it.each([
    undefined,
    null,
    true,
    {},
    [],
    { authorized: 'true' },
    { authorized: true },
    { authorized: true, actor: null },
    { authorized: true, actor: { sub: '' } },
    { authorized: true, actor: { sub: 'subject-1', roles: [] } },
    { authorized: false, actor: { sub: 'subject-1' } },
    { authorized: false, extra: true },
    Object.create({ authorized: false }),
  ])('rejects malformed Auth response %#', async (response) => {
    nats.send.mockResolvedValueOnce(of(response));
    const error = await guard
      .canActivate(context({ headers: { cookie: `sid=${sid}` } }))
      .catch((value) => value);
    expect(error).toMatchObject({ status: 502 });
    expect(error.getResponse().error.code).toBe('AUTH_UPSTREAM_ERROR');
  });

  it('inherits class tool/resource and method scope', async () => {
    class Controller {}
    const handler = function handler() {};
    Reflect.defineMetadata(
      WEB_AUTHORIZE_METADATA,
      Object.freeze({ tool: 'beneficiary', resource: 'persons' }),
      Controller,
    );
    Reflect.defineMetadata(WEB_PROTECTED_METADATA, Object.freeze({ scope: 'read' }), handler);
    const actualGuard = new WebAuthorizationGuard(nats as unknown as NatsService, new Reflector());
    nats.send.mockResolvedValueOnce(of({ authorized: true, actor }));
    await actualGuard.canActivate(
      context({ headers: { cookie: `sid=${sid}` } }, handler, Controller),
    );
    expect(nats.send).toHaveBeenCalledWith(WebAuthPatterns.authorizationCheck, {
      sid,
      tool: 'beneficiary',
      resource: 'persons',
      scope: 'read',
    });
  });

  it('uses a complete method WebAuthorize override instead of mixing resources', async () => {
    class Controller {}
    const handler = function handler() {};
    Reflect.defineMetadata(
      WEB_AUTHORIZE_METADATA,
      Object.freeze({ tool: 'beneficiary', resource: 'persons' }),
      Controller,
    );
    Reflect.defineMetadata(
      WEB_AUTHORIZE_METADATA,
      Object.freeze({ tool: 'beneficiary', resource: 'persons.records' }),
      handler,
    );
    Reflect.defineMetadata(WEB_PROTECTED_METADATA, Object.freeze({ scope: 'read' }), handler);
    const actualGuard = new WebAuthorizationGuard(nats as unknown as NatsService, new Reflector());
    nats.send.mockResolvedValueOnce(of({ authorized: true, actor }));
    await actualGuard.canActivate(
      context({ headers: { cookie: `sid=${sid}` } }, handler, Controller),
    );
    expect(nats.send).toHaveBeenCalledWith(WebAuthPatterns.authorizationCheck, {
      sid,
      tool: 'beneficiary',
      resource: 'persons.records',
      scope: 'read',
    });
  });

  it('decorators produce exact frozen metadata', () => {
    class Controller {}
    const handler = function handler() {};
    WebAuthorize('beneficiary', 'persons')(Controller);
    WebProtected('read')(Controller.prototype, 'handler', { value: handler } as PropertyDescriptor);
    expect(Reflect.getMetadata(WEB_AUTHORIZE_METADATA, Controller)).toEqual({
      tool: 'beneficiary',
      resource: 'persons',
    });
    expect(Reflect.getMetadata(WEB_PROTECTED_METADATA, handler)).toEqual({ scope: 'read' });
    expect(Object.isFrozen(Reflect.getMetadata(WEB_PROTECTED_METADATA, handler))).toBe(true);
  });

  it('reads both metadata keys with handler-before-class precedence', async () => {
    nats.send.mockResolvedValueOnce(of({ authorized: true, actor }));
    const execution = context({ headers: { cookie: `sid=${sid}` } });
    await guard.canActivate(execution);
    expect(reflector.getAllAndOverride).toHaveBeenNthCalledWith(1, WEB_AUTHORIZE_METADATA, [
      execution.getHandler(),
      execution.getClass(),
    ]);
    expect(reflector.getAllAndOverride).toHaveBeenNthCalledWith(2, WEB_PROTECTED_METADATA, [
      execution.getHandler(),
      execution.getClass(),
    ]);
  });

  it('times out, unsubscribes and returns Auth unavailable', async () => {
    jest.useFakeTimers();
    const teardown = jest.fn();
    nats.send.mockResolvedValueOnce(new Observable(() => teardown));
    const pending = guard
      .canActivate(context({ headers: { cookie: `sid=${sid}` } }))
      .catch((error) => error);
    await jest.advanceTimersByTimeAsync(5_000);
    const error = await pending;
    expect(error).toMatchObject({ status: 503 });
    expect(error.getResponse().error.code).toBe('AUTH_SERVICE_UNAVAILABLE');
    expect(teardown).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
    jest.useRealTimers();
  });
});
