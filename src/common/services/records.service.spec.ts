/// <reference types="jest" />
jest.mock('src/common', () => ({ NatsService: class NatsService {} }), { virtual: true });
import { RecordsService } from './records.service';

describe('RecordsService sensitive import metadata', () => {
  it('masks the temporary import capability at every nesting level', () => {
    const service = new RecordsService({} as never, {} as never);

    expect(
      service.sanitizeMetadata({
        importId: '7efc93cf-46a8-4b3d-94dc-f6abf406ff1d',
        nested: { importId: 'another-value' },
      }),
    ).toEqual({
      importId: '**********',
      nested: { importId: '**********' },
    });
  });
});
