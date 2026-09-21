export interface PresentationIdentity {
  sub: string;
  preferredUsername?: string;
  name?: string;
  givenName?: string;
  familyName?: string;
  email?: string;
}

export interface StartWebLoginResponse {
  authorizationUrl: string;
}

export interface ExchangeWebCodeResponse {
  sid: string;
  returnPath: string;
  identity: PresentationIdentity;
  sessionExpiresAt: number;
  sessionAbsoluteExpiresAt: number;
}

export interface CheckWebSessionResponse {
  authenticated: true;
  identity: PresentationIdentity;
  sessionExpiresAt: number;
}

export interface EnsureWebClientContextRequest {
  sid: string;
  tool: string;
}

export interface EnsureWebClientContextResponse {
  authenticated: true;
  currentTool: string;
  currentClient: string;
  identity: PresentationIdentity;
  realmRoles: string[];
  clientRoles: string[];
  groups: string[];
  contextExpiresAt: number;
  sessionExpiresAt: number;
  sessionAbsoluteExpiresAt: number;
}

export interface CheckWebAuthorizationRequest {
  sid: string;
  tool: string;
  resource: string;
  scope: string;
}

export interface WebAuthorizationActor {
  sub: string;
  preferredUsername?: string;
  name?: string;
}

export type CheckWebAuthorizationResponse =
  { authorized: true; actor: WebAuthorizationActor } | { authorized: false };

export const WebAuthPatterns = {
  loginStart: 'web-auth.login.start',
  loginExchange: 'web-auth.login.exchange',
  sessionCheck: 'web-auth.session.check',
  clientEnsure: 'web-auth.client.ensure',
  authorizationCheck: 'web-auth.authorization.check',
} as const;
