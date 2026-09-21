/// <reference types="jest" />
import { ExecutionContext, HttpException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, of, throwError } from 'rxjs';
import { NatsService } from 'src/common/services/nats.service';
import { WebAuthPatterns } from './contracts/web-auth.contracts';
import { WebAuthorizationGuard } from './web-authorization.guard';
import { WEB_OPERATION_METADATA } from './web-operation.decorator';

jest.mock('src/config', () => ({ NATS_SERVICE: 'NATS_SERVICE' }));

const sid = 's'.repeat(43);

function context(
  request: Record<string, unknown>,
  handler: Function = function handler() {},
  controller: Function = class Controller {},
): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => controller,
    switchToHttp: () => ({ getRequest: () => request }),
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
    reflector.getAllAndOverride.mockReturnValue('beneficiary.persons.read');
    guard = new WebAuthorizationGuard(
      nats as unknown as NatsService,
      reflector as unknown as Reflector,
    );
  });

  it('uses trusted metadata and sends only sid and operation', async () => {
    nats.send.mockResolvedValueOnce(of({ authorized: true }));
    const request = { headers: { cookie: `sid=${sid}` } };
    await expect(guard.canActivate(context(request))).resolves.toBe(true);
    expect(nats.send).toHaveBeenCalledWith(WebAuthPatterns.authorizationCheck, {
      sid,
      operation: 'beneficiary.persons.read',
    });
    expect(request).toEqual({ headers: { cookie: `sid=${sid}` } });
  });

  it.each([undefined, 'unknown.operation', 123])(
    'fails safely when metadata is %s',
    async (operation) => {
      reflector.getAllAndOverride.mockReturnValueOnce(operation);
      await expect(
        guard.canActivate(context({ headers: { cookie: `sid=${sid}` } })),
      ).rejects.toMatchObject({ status: 400 });
      expect(nats.send).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['missing', undefined],
    ['empty', 'sid='],
    ['invalid', 'sid=invalid'],
    ['duplicated', `sid=${sid}; sid=${'b'.repeat(43)}`],
  ])('rejects a %s sid cookie', async (_label, cookie) => {
    const request = { headers: cookie ? { cookie } : {} };
    const error = await guard.canActivate(context(request)).catch((value) => value);
    expect(error).toBeInstanceOf(HttpException);
    expect(error).toMatchObject({ status: 401 });
    expect(error.getResponse()).toEqual({
      error: {
        code: 'SESSION_INVALID',
        message: 'Session is invalid or expired',
      },
    });
    expect(nats.send).not.toHaveBeenCalled();
  });

  it('maps authorized=false to a stable denial', async () => {
    nats.send.mockResolvedValueOnce(of({ authorized: false }));
    const error = await guard
      .canActivate(context({ headers: { cookie: `sid=${sid}` } }))
      .catch((value) => value);
    expect(error).toMatchObject({ status: 403 });
    expect(error.getResponse().error.code).toBe('AUTHORIZATION_DENIED');
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
    { authorized: 'true' },
    { authorized: true, sid: 'must-not-leak' },
  ])('rejects malformed Auth response %#', async (response) => {
    nats.send.mockResolvedValueOnce(of(response));
    const error = await guard
      .canActivate(context({ headers: { cookie: `sid=${sid}` } }))
      .catch((value) => value);
    expect(error).toMatchObject({ status: 502 });
    expect(error.getResponse().error.code).toBe('AUTH_UPSTREAM_ERROR');
  });

  it.each([
    [],
    Object.create({ authorized: true }),
    Object.assign(Object.create({ inherited: true }), { authorized: true }),
  ])('rejects a non-plain Auth response', async (response) => {
    nats.send.mockResolvedValueOnce(of(response));
    await expect(
      guard.canActivate(context({ headers: { cookie: `sid=${sid}` } })),
    ).rejects.toMatchObject({ status: 502 });
  });

  it('passes handler and class to Reflector in override order', async () => {
    nats.send.mockResolvedValue(of({ authorized: true }));
    const execution = context({ headers: { cookie: `sid=${sid}` } });
    await guard.canActivate(execution);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(WEB_OPERATION_METADATA, [
      execution.getHandler(),
      execution.getClass(),
    ]);
  });

  it.each([
    ['method metadata', 'beneficiary.persons.read', undefined, true],
    ['class metadata', undefined, 'beneficiary.persons.read', true],
    ['method priority over class', 'unknown.operation', 'beneficiary.persons.read', false],
  ])('resolves %s predictably', async (_label, methodOperation, classOperation, expected) => {
    const handler = function handler() {};
    class Controller {}
    if (methodOperation !== undefined)
      Reflect.defineMetadata(WEB_OPERATION_METADATA, methodOperation, handler);
    if (classOperation !== undefined)
      Reflect.defineMetadata(WEB_OPERATION_METADATA, classOperation, Controller);
    const actualGuard = new WebAuthorizationGuard(nats as unknown as NatsService, new Reflector());
    nats.send.mockResolvedValueOnce(of({ authorized: true }));
    const result = actualGuard.canActivate(
      context({ headers: { cookie: `sid=${sid}` } }, handler, Controller),
    );
    if (expected) await expect(result).resolves.toBe(true);
    else await expect(result).rejects.toMatchObject({ status: 400 });
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

  it.each([
    ['sid_extra', `sid_extra=${sid}`],
    ['encoded', `sid=${encodeURIComponent(sid + '%')}`],
    ['space in name', `sid =${sid}`],
    ['space in value', `sid= ${sid}`],
  ])('rejects cookie variant %s', async (_label, cookie) => {
    await expect(guard.canActivate(context({ headers: { cookie } }))).rejects.toMatchObject({
      status: 401,
    });
    expect(nats.send).not.toHaveBeenCalled();
  });
});
