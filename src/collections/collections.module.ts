import { Module } from '@nestjs/common';
import { TransactionsController } from './transactions.controller';
import { BankStatementsController } from './bank-statements.controller';
import { CollectionsReportsController } from './reports.controller';
import { WebAuthorizationGuard } from 'src/auth/guards';

@Module({
  controllers: [TransactionsController, BankStatementsController, CollectionsReportsController],
  providers: [WebAuthorizationGuard],
})
export class CollectionsModule {}
