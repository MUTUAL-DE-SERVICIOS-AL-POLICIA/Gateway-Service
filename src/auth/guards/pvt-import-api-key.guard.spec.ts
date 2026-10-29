import { UnauthorizedException } from '@nestjs/common';
import { PvtImportApiKeyGuard } from './pvt-import-api-key.guard';

jest.mock('src/config', () => ({
  PvtImportEnvs: { apiKey: 'expected-key' },
}));

describe('PvtImportApiKeyGuard', () => {
  const guard = new PvtImportApiKeyGuard();
  const context = (headers: Record<string, string>) =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ headers }) }),
    }) as never;

  it('accepts the configured PVT application key', () => {
    expect(guard.canActivate(context({ 'x-api-key': 'expected-key' }))).toBe(true);
  });

  it.each([{}, { 'x-api-key': 'invalid-key' }])(
    'rejects missing or invalid application credentials',
    (headers) => {
      expect(() => guard.canActivate(context(headers))).toThrow(UnauthorizedException);
    },
  );
});
