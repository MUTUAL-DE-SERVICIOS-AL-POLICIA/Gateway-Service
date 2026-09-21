/// <reference types="jest" />
import { INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { of } from 'rxjs';
import request from 'supertest';
import { WebAuthPatterns } from 'src/auth/web-auth/contracts/web-auth.contracts';
import { WebAuthorizationGuard } from 'src/auth/web-auth/web-authorization.guard';
import { NatsService as WebNatsService } from 'src/common/services/nats.service';
import { FtpService, NatsService, RecordsService as RecordsServiceToken } from 'src/common';
import { RecordsService } from 'src/common/services/records.service';
import { AffiliatesController } from './affiliates.controller';
import { PersonsController } from './persons.controller';

jest.mock('src/config', () => ({ NATS_SERVICE: 'NATS_SERVICE' }));
jest.mock('src/common', () => ({
  NatsService: class NatsService {},
  FtpService: class FtpService {},
  RecordsService: class RecordsService {},
}));

describe('Beneficiary web authorization and RecordsService', () => {
  let app: INestApplication;
  const nats = {
    send: jest.fn(),
    firstValue: jest.fn(),
    emit: jest.fn(),
  };
  const ftp = {
    removeFile: jest.fn(),
    uploadFile: jest.fn(),
    concatChunks: jest.fn(),
    downloadFile: jest.fn(),
  };
  beforeAll(async () => {
    const builder = Test.createTestingModule({
      controllers: [PersonsController, AffiliatesController],
      providers: [
        Reflector,
        WebAuthorizationGuard,
        { provide: RecordsServiceToken, useClass: RecordsService },
        { provide: NatsService, useValue: nats },
        { provide: WebNatsService, useValue: nats },
        { provide: FtpService, useValue: ftp },
      ],
    });
    builder
      .overrideInterceptor(RecordsServiceToken)
      .useValue(new RecordsService(new Reflector(), nats as never));
    const module = await builder.compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(() => app?.close());

  beforeEach(() => {
    jest.clearAllMocks();
    nats.send.mockImplementation((pattern) => {
      if (pattern === WebAuthPatterns.authorizationCheck) {
        return Promise.resolve(
          of({
            authorized: true,
            actor: { sub: 'subject', preferredUsername: 'audit-user', name: 'Audit User' },
          }),
        );
      }
      if (pattern === 'person.findAll') {
        return Promise.resolve(of({ error: false, persons: [], total: 0 }));
      }
      throw new Error('Unexpected NATS pattern');
    });
  });

  it('does not create records for an authorized GET', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/beneficiaries/persons?page=1&limit=1')
      .set('Cookie', `sid=${'s'.repeat(43)}`)
      .expect(200);
    expect(nats.emit).not.toHaveBeenCalled();
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers.pragma).toBe('no-cache');
    expect(response.headers['set-cookie']).toBeUndefined();
  });

  it('records one PATCH with the minimum actor and preserved metadata', async () => {
    nats.firstValue.mockResolvedValueOnce({ error: true, message: 'not changed' });
    await request(app.getHttpServer())
      .patch('/api/beneficiaries/affiliates/7/fileDossier/9?trace=kept')
      .set('Cookie', `sid=${'s'.repeat(43)}`)
      .send({ initialName: 'file.pdf', totalChunks: 2, password: 'hidden' })
      .expect(200);
    expect(nats.emit).toHaveBeenCalledTimes(1);
    const [pattern, audit] = nats.emit.mock.calls[0];
    expect(pattern).toBe('beneficiaries.record.create');
    expect(audit).toMatchObject({
      action: 'PATCH: AffiliatesController.updateAffiliateFileDossier',
      input: {
        initialName: 'file.pdf',
        totalChunks: 2,
        password: '**********',
        params: { affiliateId: '7', fileDossierId: '9' },
        query: { trace: 'kept' },
        user: { username: 'audit-user', name: 'Audit User' },
      },
      output: { error: true, message: 'not changed' },
    });
    expect(JSON.stringify(audit)).not.toMatch(
      /sid|cookie|authorization|token|\bsub\b|roles|groups|tool|resource|scope/i,
    );
  });

  it('records one DELETE with the minimum actor and preserved metadata', async () => {
    nats.firstValue.mockResolvedValueOnce({ paths: [], error: true, message: 'not deleted' });
    await request(app.getHttpServer())
      .delete('/api/beneficiaries/affiliates/7/fileDossiers/9')
      .set('Cookie', `sid=${'s'.repeat(43)}`)
      .expect(200);
    expect(nats.emit).toHaveBeenCalledTimes(1);
    const [pattern, audit] = nats.emit.mock.calls[0];
    expect(pattern).toBe('beneficiaries.record.create');
    expect(audit).toMatchObject({
      action: 'DELETE: AffiliatesController.deleteFileDossier',
      input: {
        params: { affiliateId: '7', fileDossierId: '9' },
        user: { username: 'audit-user', name: 'Audit User' },
      },
      output: { error: true, message: 'not deleted' },
    });
    expect(JSON.stringify(audit)).not.toMatch(
      /sid|cookie|authorization|token|\bsub\b|roles|groups|tool|resource|scope/i,
    );
  });

  it('records a POST with only the minimum actor and no web credentials', async () => {
    nats.firstValue.mockResolvedValueOnce({
      message: 'ok',
      registros: [],
      uploadFiles: [],
      removeFiles: [],
    });
    await request(app.getHttpServer())
      .post('/api/beneficiaries/persons/1/createPersonFingerprint')
      .set('Cookie', `sid=${'s'.repeat(43)}`)
      .send({ personFingerprints: [], wsqFingerprints: [] })
      .expect(201);
    expect(nats.emit).toHaveBeenCalledTimes(1);
    const [, audit] = nats.emit.mock.calls[0];
    expect(audit.input.user).toEqual({ username: 'audit-user', name: 'Audit User' });
    expect(JSON.stringify(audit)).not.toMatch(
      /sid|cookie|token|\bsub\b|roles|groups|tool|resource|scope/i,
    );
  });

  it('preserves the functional handler error instead of converting it to an auth error', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/beneficiaries/affiliates/1/document/2')
      .set('Cookie', `sid=${'s'.repeat(43)}`)
      .expect(400);
    expect(response.body.message).toBe('Debe subir al menos un archivo PDF');
    expect(JSON.stringify(response.body)).not.toMatch(/AUTH_UPSTREAM_ERROR/);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers.pragma).toBe('no-cache');
    expect(response.headers['set-cookie']).toBeUndefined();
  });
});
