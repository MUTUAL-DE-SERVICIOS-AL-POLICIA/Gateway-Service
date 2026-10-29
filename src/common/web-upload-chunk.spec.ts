/// <reference types="jest" />
import { INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { of } from 'rxjs';
import request from 'supertest';
import { WebAuthorizationGuard } from 'src/auth/guards/web-authorization.guard';
import { WebAuthPatterns } from 'src/auth/contracts/web-auth.contracts';
import { NatsService as WebNatsService } from 'src/common/services/nats.service';
import {
  BcbService,
  CitizenshipDigitalService,
  FtpService,
  SmsService,
  WhatsappService,
} from 'src/common';
import { CommonController } from './common.controller';

jest.mock('src/config', () => ({ NATS_SERVICE: 'NATS_SERVICE' }));
jest.mock('src/common', () => ({
  BcbService: class BcbService {},
  CitizenshipDigitalService: class CitizenshipDigitalService {},
  FtpService: class FtpService {},
  SmsService: class SmsService {},
  WhatsappService: class WhatsappService {},
}));

const sid = 's'.repeat(43);

describe('CommonController web uploadChunk routes', () => {
  let app: INestApplication;
  const nats = { send: jest.fn() };
  const ftp = { uploadChunk: jest.fn() };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [CommonController],
      providers: [
        Reflector,
        WebAuthorizationGuard,
        { provide: WebNatsService, useValue: nats },
        { provide: FtpService, useValue: ftp },
        { provide: SmsService, useValue: {} },
        { provide: WhatsappService, useValue: {} },
        { provide: CitizenshipDigitalService, useValue: {} },
        { provide: BcbService, useValue: {} },
      ],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(() => app?.close());

  beforeEach(() => {
    jest.clearAllMocks();
    nats.send.mockResolvedValue(
      of({
        authenticated: true,
        currentTool: 'beneficiary',
        actor: { sub: 'subject', preferredUsername: 'operator' },
      }),
    );
  });

  it.each([
    ['create', 'write'],
    ['update', 'update'],
  ])('preserves multipart behavior for %s with a beneficiary session', async (route) => {
    const response = await request(app.getHttpServer())
      .post(`/api/common/uploadChunk/file-dossier/${route}`)
      .set('Cookie', `sid=${sid}`)
      .set('X-Muserpol-Tool', 'beneficiary')
      .field('nameChunk', 'file.part-001')
      .field('operation', 'attacker-operation')
      .field('tool', 'attacker-tool')
      .field('resource', 'attacker-resource')
      .field('scope', 'attacker-scope')
      .field('isUpdate', route === 'create' ? 'true' : 'false')
      .attach('chunk', Buffer.from('synthetic chunk'), 'chunk.bin')
      .expect(201);

    expect(nats.send).toHaveBeenCalledTimes(1);
    expect(nats.send).toHaveBeenCalledWith(WebAuthPatterns.clientCheck, {
      sid,
      tool: 'beneficiary',
    });
    const [chunk, nameChunk] = ftp.uploadChunk.mock.calls[0];
    expect(ftp.uploadChunk).toHaveBeenCalledTimes(1);
    expect(chunk).toMatchObject({ fieldname: 'chunk', originalname: 'chunk.bin' });
    expect(Buffer.isBuffer(chunk.buffer)).toBe(true);
    expect(nameChunk).toBe('file.part-001');
    expect(response.body).toEqual({
      message: 'Chunk subido exitosamente',
      serviceStatus: true,
    });
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers.pragma).toBe('no-cache');
    expect(response.headers['set-cookie']).toBeUndefined();
  });

  it('does not expose the legacy uploadChunk route', async () => {
    await request(app.getHttpServer())
      .post('/api/common/uploadChunk')
      .set('Cookie', `sid=${sid}`)
      .attach('chunk', Buffer.from('synthetic chunk'), 'chunk.bin')
      .expect(404);
    expect(nats.send).not.toHaveBeenCalled();
    expect(ftp.uploadChunk).not.toHaveBeenCalled();
  });
});
