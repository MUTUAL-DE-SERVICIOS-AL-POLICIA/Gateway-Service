import {
  WEB_CONTROLLER_METADATA,
  WEB_PERMISSION_METADATA,
} from 'src/auth/decorators/web-authorization.metadata';
import { BankStatementsController } from './bank-statements.controller';
import { CollectionsReportsController } from './reports.controller';
import { TransactionsController } from './transactions.controller';

describe('Collections web authorization metadata', () => {
  it.each([
    [TransactionsController, 'transactions'],
    [BankStatementsController, 'bank_statements'],
    [CollectionsReportsController, 'reports'],
  ])('binds %p to the expected resource', (controller, resource) => {
    expect(Reflect.getMetadata(WEB_CONTROLLER_METADATA, controller)).toEqual({
      tool: 'collections',
      resource,
    });
  });

  it.each([
    [TransactionsController, 'findAll', 'read'],
    [BankStatementsController, 'findAll', 'read'],
    [BankStatementsController, 'importBankStatements', 'write'],
    [CollectionsReportsController, 'reportAllSales', 'download'],
  ])('protects %p.%s with %s', (controller, method, scope) => {
    expect(Reflect.getMetadata(WEB_PERMISSION_METADATA, controller.prototype[method])).toEqual({
      scope,
    });
  });
});
