/// <reference types="jest" />
import { clientContextResponse, InvalidWebAuthResponseError } from './web-auth.responses';

describe('clientContextResponse', () => {
  const valid = () => {
    const now = Date.now();
    return {
      authenticated: true,
      currentTool: 'beneficiary',
      currentClient: 'beneficiary-interface',
      identity: { sub: 'subject' },
      realmRoles: ['realm-role'],
      clientRoles: ['read'],
      groups: ['/beneficiary'],
      permissions: [{ resource: 'persons', scopes: ['read'] }],
      contextExpiresAt: now + 90_000,
      permissionsExpiresAt: now + 60_000,
      sessionExpiresAt: now + 120_000,
      sessionAbsoluteExpiresAt: now + 180_000,
    };
  };

  it('accepts only the public permission contract', () => {
    const value = valid();
    expect(clientContextResponse(value)).toEqual(value);
  });

  it.each([
    { accessToken: 'must-not-leak' },
    { permissions: [{ resource: 'persons', scopes: ['read'], rsid: 'internal' }] },
    { permissions: [{ resource: 'persons', scopes: ['read', 'read'] }] },
  ])('rejects extra or ambiguous fields', (change) => {
    const candidate = { ...valid(), ...change };
    expect(() => clientContextResponse(candidate)).toThrow(InvalidWebAuthResponseError);
  });
});
