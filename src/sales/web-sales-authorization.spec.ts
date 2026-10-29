import {
  WEB_CONTROLLER_METADATA,
  WEB_PERMISSION_METADATA,
} from 'src/auth/decorators/web-authorization.metadata';
import { SalesController } from './sales.controller';
import { SalesPersonsController } from './sales-persons.controller';

describe('Sales web authorization metadata', () => {
  it('uses the sales tool and persons resource for person lookups', () => {
    expect(Reflect.getMetadata(WEB_CONTROLLER_METADATA, SalesPersonsController)).toEqual({
      tool: 'sales',
      resource: 'persons',
    });
    for (const method of ['searchPerson', 'findPerson']) {
      expect(
        Reflect.getMetadata(WEB_PERMISSION_METADATA, SalesPersonsController.prototype[method]),
      ).toEqual({ scope: 'read' });
    }
  });

  it.each([
    ['groupProducts', { scope: 'read' }],
    ['groupsCheck', { scope: 'read' }],
    ['generateQr', { scope: 'write', subresource: 'qr' }],
    ['createSale', { scope: 'write' }],
    ['personSales', { scope: 'read' }],
    ['personPendingQr', { scope: 'read', subresource: 'qr' }],
    ['voucherPdf', { scope: 'download', subresource: 'vouchers' }],
    ['reportAllSales', { scope: 'download', subresource: 'reports' }],
    ['getQrImage', { scope: 'read', subresource: 'qr' }],
    ['personRecords', { scope: 'read', subresource: 'records' }],
    ['forGenerateReport', { scope: 'read', subresource: 'reports' }],
    ['cancelSale', { scope: 'update' }],
  ])('protects %s with its declared permission', (method, permission) => {
    expect(Reflect.getMetadata(WEB_PERMISSION_METADATA, SalesController.prototype[method])).toEqual(
      permission,
    );
  });
});
