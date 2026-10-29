import {
  CheckWebAuthorizationResponse,
  CheckWebClientResponse,
  CheckWebSessionResponse,
  EnsureWebClientContextResponse,
  ExchangeWebCodeResponse,
  LogoutWebSessionResponse,
  PresentationIdentity,
  StartWebLoginResponse,
} from '../contracts/web-auth.contracts';

export class InvalidWebAuthResponseError extends Error {}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new InvalidWebAuthResponseError();
  return value as Record<string, unknown>;
}

function requiredString(value: unknown): string {
  if (typeof value !== 'string' || !value) throw new InvalidWebAuthResponseError();
  return value;
}

function opaqueId(value: unknown): string {
  const id = requiredString(value);
  if (!/^[A-Za-z0-9_-]{43,128}$/.test(id)) throw new InvalidWebAuthResponseError();
  return id;
}

function optionalString(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  return requiredString(value);
}

function expiration(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) <= 0)
    throw new InvalidWebAuthResponseError();
  return value as number;
}

function epochMilliseconds(value: unknown): number {
  const parsed = expiration(value);
  if (parsed < 1_000_000_000_000) throw new InvalidWebAuthResponseError();
  return parsed;
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string'))
    throw new InvalidWebAuthResponseError();
  return [...value];
}

function identity(value: unknown): PresentationIdentity {
  const source = record(value);
  return {
    sub: requiredString(source.sub),
    preferredUsername: optionalString(source.preferredUsername),
    name: optionalString(source.name),
    givenName: optionalString(source.givenName),
    familyName: optionalString(source.familyName),
    email: optionalString(source.email),
  };
}

function authorizationActor(value: unknown) {
  const source = record(value);
  if (
    Object.getPrototypeOf(source) !== Object.prototype ||
    Object.keys(source).some((key) => !['sub', 'preferredUsername', 'name'].includes(key)) ||
    Object.keys(source).length < 1
  )
    throw new InvalidWebAuthResponseError();
  const actor = {
    sub: requiredString(source.sub),
    preferredUsername: optionalString(source.preferredUsername),
    name: optionalString(source.name),
  };
  return Object.fromEntries(
    Object.entries(actor).filter(([, item]) => item !== undefined),
  ) as typeof actor;
}

function safeReturnPath(value: unknown): string {
  const path = requiredString(value);
  if (
    path.includes('#') ||
    path.includes('\\') ||
    path.includes('//') ||
    path.split('?')[0].includes('%') ||
    (path !== '/apphub' && !path.startsWith('/apphub/'))
  )
    throw new InvalidWebAuthResponseError();
  return path;
}

export function startResponse(value: unknown): StartWebLoginResponse {
  const source = record(value);
  const authorizationUrl = requiredString(source.authorizationUrl);
  let url: URL;
  try {
    url = new URL(authorizationUrl);
  } catch {
    throw new InvalidWebAuthResponseError();
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.hash ||
    ['access_token', 'refresh_token', 'id_token', 'code', 'code_verifier', 'sid'].some((name) =>
      url.searchParams.has(name),
    )
  )
    throw new InvalidWebAuthResponseError();
  return { authorizationUrl };
}

export function exchangeResponse(value: unknown): ExchangeWebCodeResponse {
  const source = record(value);
  return {
    sid: opaqueId(source.sid),
    returnPath: safeReturnPath(source.returnPath),
    identity: identity(source.identity),
    sessionExpiresAt: expiration(source.sessionExpiresAt),
    sessionAbsoluteExpiresAt: expiration(source.sessionAbsoluteExpiresAt),
  };
}

export function logoutResponse(value: unknown): LogoutWebSessionResponse {
  const source = record(value);
  const logoutUrl = requiredString(source.logoutUrl);
  let url: URL;
  try {
    url = new URL(logoutUrl);
  } catch {
    throw new InvalidWebAuthResponseError();
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
    throw new InvalidWebAuthResponseError();
  return { logoutUrl };
}

export function sessionResponse(value: unknown): CheckWebSessionResponse {
  const source = record(value);
  if (source.authenticated !== true) throw new InvalidWebAuthResponseError();
  return {
    authenticated: true,
    identity: identity(source.identity),
    sessionExpiresAt: expiration(source.sessionExpiresAt),
  };
}

export function authorizationResponse(value: unknown): CheckWebAuthorizationResponse {
  const source = record(value);
  if (Object.getPrototypeOf(source) !== Object.prototype) {
    throw new InvalidWebAuthResponseError();
  }
  if (
    source.authorized === false &&
    Object.keys(source).length === 1 &&
    Object.prototype.hasOwnProperty.call(source, 'authorized')
  )
    return { authorized: false };
  if (
    source.authorized === true &&
    Object.keys(source).length === 2 &&
    Object.prototype.hasOwnProperty.call(source, 'authorized') &&
    Object.prototype.hasOwnProperty.call(source, 'actor')
  )
    return { authorized: true, actor: authorizationActor(source.actor) };
  throw new InvalidWebAuthResponseError();
}

export function clientCheckResponse(value: unknown): CheckWebClientResponse {
  const source = record(value);
  if (
    Object.getPrototypeOf(source) !== Object.prototype ||
    Object.keys(source).length !== 3 ||
    source.authenticated !== true ||
    !Object.prototype.hasOwnProperty.call(source, 'currentTool') ||
    !Object.prototype.hasOwnProperty.call(source, 'actor')
  )
    throw new InvalidWebAuthResponseError();
  return {
    authenticated: true,
    currentTool: requiredString(source.currentTool),
    actor: authorizationActor(source.actor),
  };
}

export function clientContextResponse(value: unknown): EnsureWebClientContextResponse {
  const source = record(value);
  const allowed = [
    'authenticated',
    'currentTool',
    'currentClient',
    'identity',
    'realmRoles',
    'clientRoles',
    'groups',
    'permissions',
    'contextExpiresAt',
    'permissionsExpiresAt',
    'sessionExpiresAt',
    'sessionAbsoluteExpiresAt',
  ];
  if (
    Object.getPrototypeOf(source) !== Object.prototype ||
    Object.keys(source).some((key) => !allowed.includes(key)) ||
    Object.keys(source).length !== allowed.length ||
    source.authenticated !== true ||
    !Array.isArray(source.permissions)
  )
    throw new InvalidWebAuthResponseError();

  const permissions = source.permissions.map((candidate) => {
    const permission = record(candidate);
    if (
      Object.getPrototypeOf(permission) !== Object.prototype ||
      Object.keys(permission).length !== 2 ||
      !Object.prototype.hasOwnProperty.call(permission, 'resource') ||
      !Object.prototype.hasOwnProperty.call(permission, 'scopes')
    )
      throw new InvalidWebAuthResponseError();
    const resource = requiredString(permission.resource);
    const scopes = stringList(permission.scopes);
    if (
      !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(resource) ||
      scopes.some((scope) => !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(scope)) ||
      new Set(scopes).size !== scopes.length
    )
      throw new InvalidWebAuthResponseError();
    return { resource, scopes };
  });
  const contextExpiresAt = epochMilliseconds(source.contextExpiresAt);
  const permissionsExpiresAt = epochMilliseconds(source.permissionsExpiresAt);
  const sessionExpiresAt = epochMilliseconds(source.sessionExpiresAt);
  const sessionAbsoluteExpiresAt = epochMilliseconds(source.sessionAbsoluteExpiresAt);
  if (
    permissionsExpiresAt > contextExpiresAt ||
    contextExpiresAt > sessionExpiresAt ||
    sessionExpiresAt > sessionAbsoluteExpiresAt
  )
    throw new InvalidWebAuthResponseError();
  return {
    authenticated: true,
    currentTool: requiredString(source.currentTool),
    currentClient: requiredString(source.currentClient),
    identity: identity(source.identity),
    realmRoles: stringList(source.realmRoles),
    clientRoles: stringList(source.clientRoles),
    groups: stringList(source.groups),
    permissions,
    contextExpiresAt,
    permissionsExpiresAt,
    sessionExpiresAt,
    sessionAbsoluteExpiresAt,
  };
}
