/// <reference types="jest" />
import { RequestMethod } from '@nestjs/common';
import {
  GUARDS_METADATA,
  INTERCEPTORS_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants';
import { WebAuthorizationGuard } from 'src/auth/web-auth/web-authorization.guard';
import {
  WEB_AUTHORIZE_METADATA,
  WEB_PROTECTED_METADATA,
} from 'src/auth/web-auth/web-authorization.decorators';
import { RecordsService } from 'src/common';
import { CommonController } from 'src/common/common.controller';
import { AffiliatesController } from './affiliates.controller';
import { PersonsController } from './persons.controller';

jest.mock('src/config', () => ({ NATS_SERVICE: 'NATS_SERVICE' }));
jest.mock('src/common', () => ({
  NatsService: class NatsService {},
  FtpService: class FtpService {},
  SmsService: class SmsService {},
  WhatsappService: class WhatsappService {},
  CitizenshipDigitalService: class CitizenshipDigitalService {},
  BcbService: class BcbService {},
  RecordsService: class RecordsService {},
}));

type RouteExpectation = readonly [
  controller: Function,
  method: string,
  verb: RequestMethod,
  path: string,
  resource: string,
  scope: string,
];

const routes: readonly RouteExpectation[] = [
  [
    PersonsController,
    'showListFingerprint',
    RequestMethod.GET,
    'showListFingerprint',
    'persons.fingerprints',
    'read',
  ],
  [PersonsController, 'findAllPersons', RequestMethod.GET, '/', 'persons', 'read'],
  [PersonsController, 'findOnePersons', RequestMethod.GET, ':term', 'persons', 'read'],
  [PersonsController, 'findPerson', RequestMethod.GET, ':uuid/details', 'persons', 'read'],
  [
    PersonsController,
    'findBeneficiaries',
    RequestMethod.GET,
    ':personId/beneficiaries',
    'persons',
    'read',
  ],
  [
    PersonsController,
    'findAffiliteRelatedWithPerson',
    RequestMethod.GET,
    ':personId/affiliates',
    'persons.affiliates',
    'read',
  ],
  [
    PersonsController,
    'createPersonFingerprint',
    RequestMethod.POST,
    ':personId/createPersonFingerprint',
    'persons.fingerprints',
    'write',
  ],
  [
    PersonsController,
    'showFingerprintRegistered',
    RequestMethod.GET,
    'showPersonFingerprint/:id',
    'persons.fingerprints',
    'read',
  ],
  [
    PersonsController,
    'getPersonRecords',
    RequestMethod.GET,
    'records/:personId',
    'persons.records',
    'read',
  ],
  [
    PersonsController,
    'searchAffiliate',
    RequestMethod.GET,
    'search/:value/:type',
    'persons',
    'read',
  ],
  [
    AffiliatesController,
    'createFileDossier',
    RequestMethod.GET,
    'createFileDossier/:affiliateId',
    'affiliates.file_dossiers',
    'read',
  ],
  [
    AffiliatesController,
    'createDocument',
    RequestMethod.GET,
    'createDocument/:affiliateId',
    'affiliates.documents',
    'read',
  ],
  [AffiliatesController, 'findOneData', RequestMethod.GET, ':affiliateId', 'affiliates', 'read'],
  [
    AffiliatesController,
    'createAffiliateDocument',
    RequestMethod.POST,
    ':affiliateId/document/:procedureDocumentId',
    'affiliates.documents',
    'write',
  ],
  [
    AffiliatesController,
    'updateAffiliateDocument',
    RequestMethod.PATCH,
    ':affiliateId/document/:procedureDocumentId',
    'affiliates.documents',
    'update',
  ],
  [
    AffiliatesController,
    'deleteDocument',
    RequestMethod.DELETE,
    ':affiliateId/documents/:procedureDocumentId',
    'affiliates.documents',
    'delete',
  ],
  [
    AffiliatesController,
    'showDocuments',
    RequestMethod.GET,
    ':affiliateId/documents',
    'affiliates.documents',
    'read',
  ],
  [
    AffiliatesController,
    'showFileDossiers',
    RequestMethod.GET,
    ':affiliateId/showFileDossiers',
    'affiliates.file_dossiers',
    'read',
  ],
  [
    AffiliatesController,
    'createAffiliateFileDossier',
    RequestMethod.POST,
    ':affiliateId/fileDossier/:fileDossierId',
    'affiliates.file_dossiers',
    'write',
  ],
  [
    AffiliatesController,
    'updateAffiliateFileDossier',
    RequestMethod.PATCH,
    ':affiliateId/fileDossier/:fileDossierId',
    'affiliates.file_dossiers',
    'update',
  ],
  [
    AffiliatesController,
    'findFileDossier',
    RequestMethod.GET,
    ':affiliateId/fileDossiers/:fileDossierId',
    'affiliates.file_dossiers',
    'download',
  ],
  [
    AffiliatesController,
    'findDocument',
    RequestMethod.GET,
    ':affiliateId/documents/:procedureDocumentId',
    'affiliates.documents',
    'download',
  ],
  [
    AffiliatesController,
    'deleteFileDossier',
    RequestMethod.DELETE,
    ':affiliateId/fileDossiers/:fileDossierId',
    'affiliates.file_dossiers',
    'delete',
  ],
  [
    AffiliatesController,
    'collateDocuments',
    RequestMethod.GET,
    ':affiliateId/modality/:modalityId/collate',
    'affiliates.documents',
    'collate',
  ],
  [
    AffiliatesController,
    'documentsAnalysis',
    RequestMethod.POST,
    'documents/analysis',
    'affiliates.documents',
    'import',
  ],
  [
    AffiliatesController,
    'documentsImports',
    RequestMethod.POST,
    'documents/imports',
    'affiliates.documents',
    'import',
  ],
];

describe('Beneficiary web authorization metadata', () => {
  it.each([
    [PersonsController, routes.filter(([controller]) => controller === PersonsController)],
    [AffiliatesController, routes.filter(([controller]) => controller === AffiliatesController)],
  ])('%s exposes exactly the approved HTTP handlers', (controller, expectedRoutes) => {
    const actualHandlers = Object.getOwnPropertyNames(controller.prototype)
      .filter((method) =>
        Reflect.hasMetadata(METHOD_METADATA, (controller.prototype as any)[method]),
      )
      .sort();
    const expectedHandlers = expectedRoutes.map(([, method]) => method).sort();
    expect(actualHandlers).toEqual(expectedHandlers);
  });

  it.each(routes)(
    '%s.%s preserves route and declares beneficiary/%s/%s',
    (controller, method, verb, path, resource, scope) => {
      const handler = (controller as any).prototype[method];
      expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(verb);
      expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe(path);
      expect(Reflect.getMetadata(WEB_AUTHORIZE_METADATA, handler)).toEqual({
        tool: 'beneficiary',
        resource,
      });
      expect(Reflect.getMetadata(WEB_PROTECTED_METADATA, handler)).toEqual({ scope });
    },
  );

  it.each([PersonsController, AffiliatesController])(
    '%s uses only the web guard and preserves RecordsService',
    (controller) => {
      expect(Reflect.getMetadata(GUARDS_METADATA, controller)).toEqual([WebAuthorizationGuard]);
      expect(Reflect.getMetadata(INTERCEPTORS_METADATA, controller)).toEqual([RecordsService]);
    },
  );

  it('keeps the auxiliary persons method non-routable', () => {
    expect(
      Reflect.getMetadata(PATH_METADATA, PersonsController.prototype.showPersonsRelatedToAffiliate),
    ).toBeUndefined();
  });

  it.each([
    ['uploadChunkForFileDossierCreate', 'uploadChunk/file-dossier/create', 'write'],
    ['uploadChunkForFileDossierUpdate', 'uploadChunk/file-dossier/update', 'update'],
  ])('protects CommonController.%s with fixed upload metadata', (method, path, scope) => {
    const handler = (CommonController.prototype as any)[method];
    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(RequestMethod.POST);
    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe(path);
    expect(Reflect.getMetadata(WEB_AUTHORIZE_METADATA, handler)).toEqual({
      tool: 'beneficiary',
      resource: 'affiliates.file_dossiers',
    });
    expect(Reflect.getMetadata(WEB_PROTECTED_METADATA, handler)).toEqual({ scope });
    expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toEqual([WebAuthorizationGuard]);
  });

  it('removes the legacy uploadChunk route', () => {
    const paths = Object.getOwnPropertyNames(CommonController.prototype)
      .map((method) =>
        Reflect.getMetadata(PATH_METADATA, (CommonController.prototype as any)[method]),
      )
      .filter(Boolean);
    expect(paths).not.toContain('uploadChunk');
  });
});
