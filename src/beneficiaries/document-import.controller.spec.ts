/// <reference types="jest" />
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { of } from 'rxjs';
import request from 'supertest';
import { WebAuthPatterns } from 'src/auth/contracts/web-auth.contracts';
import { WebAuthorizationGuard } from 'src/auth/guards/web-authorization.guard';
import { FtpService, NatsService, RecordsService } from 'src/common';
import { NatsService as WebNatsService } from 'src/common/services/nats.service';
import { AffiliatesController } from './affiliates.controller';

jest.mock('src/config', () => ({ NATS_SERVICE: 'NATS_SERVICE' }));
jest.mock('src/common', () => ({
  NatsService: class NatsService {},
  FtpService: class FtpService {},
  RecordsService: class RecordsService {},
}));

const sid = 's'.repeat(43);
const importId = '7efc93cf-46a8-4b3d-94dc-f6abf406ff1d';

describe('PVTBE document import HTTP contract', () => {
  let app: INestApplication;
  const nats = { send: jest.fn(), emit: jest.fn() };
  const ftp = {};
  const records = { intercept: jest.fn((_context, next) => next.handle()) };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AffiliatesController],
      providers: [
        Reflector,
        WebAuthorizationGuard,
        { provide: NatsService, useValue: nats },
        { provide: WebNatsService, useValue: nats },
        { provide: FtpService, useValue: ftp },
        { provide: RecordsService, useValue: records },
      ],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    await app.init();
  });

  afterAll(() => app?.close());

  beforeEach(() => {
    jest.clearAllMocks();
    nats.send.mockImplementation((pattern: string, payload: unknown) => {
      if (pattern === WebAuthPatterns.authorizationCheck) {
        return Promise.resolve(
          of({
            authorized: true,
            actor: { sub: 'subject', preferredUsername: 'operator', name: 'Operator' },
          }),
        );
      }
      if (pattern === 'affiliate.documentsAnalysis') {
        return of({ importId, totalFolder: 1 });
      }
      if (pattern === 'affiliate.documentsImports') {
        return of({ totalFiles: 1 });
      }
      throw new Error(`Unexpected NATS pattern: ${pattern} ${JSON.stringify(payload)}`);
    });
  });

  it('rejects legacy credentials and does not send them through NATS', async () => {
    await request(app.getHttpServer())
      .post('/api/beneficiaries/affiliates/documents/analysis')
      .set('Cookie', `sid=${sid}`)
      .send({ user: 'legacy', pass: 'secret', path: '/untrusted' })
      .expect(400);

    expect(nats.send).toHaveBeenCalledTimes(1);
    expect(nats.send).toHaveBeenCalledWith(WebAuthPatterns.authorizationCheck, {
      sid,
      tool: 'beneficiary',
      resource: 'affiliates.documents',
      scope: 'import',
    });
    expect(JSON.stringify(nats.send.mock.calls)).not.toContain('secret');
  });

  it('builds the analysis payload only from the authorized actor', async () => {
    await request(app.getHttpServer())
      .post('/api/beneficiaries/affiliates/documents/analysis')
      .set('Cookie', `sid=${sid}`)
      .send({})
      .expect(201);

    expect(nats.send).toHaveBeenLastCalledWith('affiliate.documentsAnalysis', {
      actor: { username: 'operator', name: 'Operator' },
    });
  });

  it('accepts only importId and injects the authorized actor', async () => {
    await request(app.getHttpServer())
      .post('/api/beneficiaries/affiliates/documents/imports')
      .set('Cookie', `sid=${sid}`)
      .send({ importId })
      .expect(201);

    expect(nats.send).toHaveBeenLastCalledWith('affiliate.documentsImports', {
      importId,
      actor: { username: 'operator', name: 'Operator' },
    });
  });

  it('rejects a client supplied actor and plan fields', async () => {
    await request(app.getHttpServer())
      .post('/api/beneficiaries/affiliates/documents/imports')
      .set('Cookie', `sid=${sid}`)
      .send({
        importId,
        actor: { username: 'forged' },
        dataValidRealNotExist: [{ oldPath: '/forged' }],
      })
      .expect(400);

    expect(nats.send).toHaveBeenCalledTimes(1);
  });
});
