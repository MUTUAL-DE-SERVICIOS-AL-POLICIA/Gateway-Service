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

export const WebAuthPatterns = {
  loginStart: 'web-auth.login.start',
  loginExchange: 'web-auth.login.exchange',
  sessionCheck: 'web-auth.session.check',
  clientEnsure: 'web-auth.client.ensure',
} as const;
