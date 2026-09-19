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
}

export interface CheckWebSessionResponse {
  authenticated: true;
  identity: PresentationIdentity;
  sessionExpiresAt: number;
}

export const WebAuthPatterns = {
  loginStart: 'web-auth.login.start',
  loginExchange: 'web-auth.login.exchange',
  sessionCheck: 'web-auth.session.check',
} as const;
