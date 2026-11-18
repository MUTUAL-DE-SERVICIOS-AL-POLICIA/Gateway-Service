/// <reference types="jest" />
import { ExecutionContext, HttpException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, of } from 'rxjs';
import { WebAuthPatterns } from '../contracts/web-auth.contracts';
import {
  WebController,
  WebPermission,
  WebSessionOnly,
  WebSharedSession,
} from '../decorators/web-authorization.decorators';
import {
  WEB_CONTROLLER_METADATA,
  WEB_PERMISSION_METADATA,
  WEB_SHARED_SESSION_METADATA,
  WEB_SESSION_ONLY_METADATA,
} from '../decorators/web-authorization.metadata';
import { NatsService } from 'src/common/services/nats.service';
import { WebAuthorizationGuard } from './web-authorization.guard';

jest.mock('src/config', () => ({ NATS_SERVICE: 'NATS_SERVICE' }));

const sid = 's'.repeat(43);
const actor = { sub: 'subject-1', preferredUsername: 'operator', name: 'Operator' };

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

function metadataContext(
  permission: { scope: string; subresource?: string } | undefined,
  sessionOnly = false,
) {
  const handler = function handler() {};
  const controller = class Controller {};
  Reflect.defineMetadata(
    WEB_CONTROLLER_METADATA,
    Object.freeze({ tool: 'beneficiary', resource: 'persons' }),
    controller,
  );
  if (permission)
    Reflect.defineMetadata(WEB_PERMISSION_METADATA, Object.freeze(permission), handler);
  if (sessionOnly) Reflect.defineMetadata(WEB_SESSION_ONLY_METADATA, true, handler);
  return { handler, controller };
}

describe('WebAuthorizationGuard', () => {
  const nats = { send: jest.fn() };
  let guard: WebAuthorizationGuard;

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new WebAuthorizationGuard(nats as unknown as NatsService, new Reflector());
  });

  it('builds resource.subresource from trusted metadata and installs the minimum actor', async () => {
    const { handler, controller } = metadataContext({ scope: 'read', subresource: 'records' });
    nats.send.mockResolvedValueOnce(of({ authorized: true, actor }));
    const request = { headers: { cookie: `sid=${sid}` } };
    await expect(guard.canActivate(context(request, handler, controller))).resolves.toBe(true);
    expect(nats.send).toHaveBeenCalledWith(WebAuthPatterns.authorizationCheck, {
      sid,
      tool: 'beneficiary',
      resource: 'persons.records',
      scope: 'read',
    });
    expect(request).toEqual({
      headers: { cookie: `sid=${sid}` },
      user: { username: 'operator', name: 'Operator' },
    });
  });

  it('uses the base resource when subresource is absent', async () => {
    const { handler, controller } = metadataContext({ scope: 'read' });
    nats.send.mockResolvedValueOnce(of({ authorized: true, actor }));
    await guard.canActivate(context({ headers: { cookie: `sid=${sid}` } }, handler, controller));
    expect(nats.send).toHaveBeenCalledWith(WebAuthPatterns.authorizationCheck, {
      sid,
      tool: 'beneficiary',
      resource: 'persons',
      scope: 'read',
    });
  });

  it('supports session-only handlers in a fixed web controller through client.check', async () => {
    const { handler, controller } = metadataContext(undefined, true);
    nats.send.mockResolvedValueOnce(of({ authenticated: true, currentTool: 'beneficiary', actor }));
    const request: Record<string, any> = { headers: { cookie: `sid=${sid}` } };
    await guard.canActivate(context(request, handler, controller));
    expect(nats.send).toHaveBeenCalledWith(WebAuthPatterns.clientCheck, {
      sid,
      tool: 'beneficiary',
    });
    expect(request.user).toEqual({ username: 'operator', name: 'Operator' });
  });

  it('accepts a shared session tool only from the dedicated header', async () => {
    const handler = function handler() {};
    Reflect.defineMetadata(WEB_SHARED_SESSION_METADATA, true, handler);
    nats.send.mockResolvedValueOnce(of({ authenticated: true, currentTool: 'sales', actor }));
    const request: Record<string, any> = {
      headers: { cookie: `sid=${sid}`, 'x-muserpol-tool': 'sales' },
      body: { tool: 'beneficiary' },
      query: { tool: 'beneficiary' },
    };
    await guard.canActivate(context(request, handler));
    expect(nats.send).toHaveBeenCalledWith(WebAuthPatterns.clientCheck, {
      sid,
      tool: 'sales',
    });
  });

  it.each([
    ['missing', undefined],
    ['malformed', 'sales,beneficiary'],
    ['unknown syntax', 'Sales'],
  ])('rejects a %s shared tool header before NATS', async (_label, value) => {
    const handler = function handler() {};
    Reflect.defineMetadata(WEB_SHARED_SESSION_METADATA, true, handler);
    const headers: Record<string, string> = { cookie: `sid=${sid}` };
    if (value !== undefined) headers['x-muserpol-tool'] = value;
    await expect(guard.canActivate(context({ headers }, handler))).rejects.toMatchObject({
      status: 400,
    });
    expect(nats.send).not.toHaveBeenCalled();
  });

  it.each([
    ['missing method classification', undefined, false],
    ['permission and session-only together', { scope: 'read' }, true],
    ['invalid scope', { scope: 'read write' }, false],
    ['invalid subresource', { scope: 'read', subresource: 'records.detail' }, false],
    ['unexpected permission field', { scope: 'read', resource: 'other' }, false],
  ])('fails closed for %s', async (_label, permission, sessionOnly) => {
    const { handler, controller } = metadataContext(permission as any, sessionOnly);
    await expect(
      guard.canActivate(context({ headers: { cookie: `sid=${sid}` } }, handler, controller)),
    ).rejects.toMatchObject({ status: 400 });
    expect(nats.send).not.toHaveBeenCalled();
  });

  it('fails closed for manipulated controller metadata', async () => {
    const { handler, controller } = metadataContext({ scope: 'read' });
    Reflect.defineMetadata(
      WEB_CONTROLLER_METADATA,
      { tool: 'beneficiary', resource: 'persons', audience: 'other' },
      controller,
    );
    await expect(
      guard.canActivate(context({ headers: { cookie: `sid=${sid}` } }, handler, controller)),
    ).rejects.toMatchObject({ status: 400 });
    expect(nats.send).not.toHaveBeenCalled();
  });

  it.each([
    ['object', { username: 'traditional-user' }],
    ['primitive', 'unexpected-user'],
  ])('rejects a preexisting request.user without NATS for %s', async (_label, user) => {
    const { handler, controller } = metadataContext({ scope: 'read' });
    const request = { headers: { cookie: `sid=${sid}` }, user };
    const original = request.user;
    const error = await guard.canActivate(context(request, handler, controller)).catch((e) => e);
    expect(error).toBeInstanceOf(HttpException);
    expect(error).toMatchObject({ status: 500 });
    expect(request.user).toBe(original);
    expect(nats.send).not.toHaveBeenCalled();
  });

  it('maps an explicit denial without installing an actor', async () => {
    const { handler, controller } = metadataContext({ scope: 'read' });
    nats.send.mockResolvedValueOnce(of({ authorized: false }));
    const request: Record<string, any> = { headers: { cookie: `sid=${sid}` } };
    const error = await guard.canActivate(context(request, handler, controller)).catch((e) => e);
    expect(error).toMatchObject({ status: 403 });
    expect(request.user).toBeUndefined();
  });

  it('sets no-store headers before reading authorization', async () => {
    const { handler, controller } = metadataContext({ scope: 'read' });
    const response = { setHeader: jest.fn() };
    await guard
      .canActivate(context({ headers: {} }, handler, controller, response))
      .catch(() => undefined);
    expect(response.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(response.setHeader).toHaveBeenCalledWith('Pragma', 'no-cache');
    expect(response.setHeader).not.toHaveBeenCalledWith('Set-Cookie', expect.anything());
  });

  it('times out and unsubscribes from NATS', async () => {
    jest.useFakeTimers();
    const { handler, controller } = metadataContext({ scope: 'read' });
    const teardown = jest.fn();
    nats.send.mockResolvedValueOnce(new Observable(() => teardown));
    const pending = guard
      .canActivate(context({ headers: { cookie: `sid=${sid}` } }, handler, controller))
      .catch((error) => error);
    await jest.advanceTimersByTimeAsync(5_000);
    const error = await pending;
    expect(error).toMatchObject({ status: 503 });
    expect(teardown).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it('decorators produce frozen controller, permission and session-only metadata', () => {
    class Controller {}
    const permissionHandler = function permissionHandler() {};
    const sessionHandler = function sessionHandler() {};
    const sharedHandler = function sharedHandler() {};
    WebController('beneficiary', 'persons')(Controller);
    WebPermission('read', 'records')(Controller.prototype, 'permissionHandler', {
      value: permissionHandler,
    } as PropertyDescriptor);
    WebSessionOnly()(Controller.prototype, 'sessionHandler', {
      value: sessionHandler,
    } as PropertyDescriptor);
    WebSharedSession()(Controller.prototype, 'sharedHandler', {
      value: sharedHandler,
    } as PropertyDescriptor);
    expect(Reflect.getMetadata(WEB_CONTROLLER_METADATA, Controller)).toEqual({
      tool: 'beneficiary',
      resource: 'persons',
    });
    expect(Reflect.getMetadata(WEB_PERMISSION_METADATA, permissionHandler)).toEqual({
      scope: 'read',
      subresource: 'records',
    });
    expect(Reflect.getMetadata(WEB_SESSION_ONLY_METADATA, sessionHandler)).toBe(true);
    expect(Reflect.getMetadata(WEB_SHARED_SESSION_METADATA, sharedHandler)).toBe(true);
    expect(Object.isFrozen(Reflect.getMetadata(WEB_PERMISSION_METADATA, permissionHandler))).toBe(
      true,
    );
  });
});
