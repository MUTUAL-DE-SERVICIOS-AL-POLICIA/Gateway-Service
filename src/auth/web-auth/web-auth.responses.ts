import {
  CheckWebSessionResponse,
  ExchangeWebCodeResponse,
  PresentationIdentity,
  StartWebLoginResponse,
} from './contracts/web-auth.contracts';

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
  };
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
