import { Module } from '@nestjs/common';
import { TransactionsController } from './transactions.controller';
import { BankStatementsController } from './bank-statements.controller';
import { CollectionsReportsController } from './reports.controller';

@Module({
  controllers: [TransactionsController, BankStatementsController, CollectionsReportsController],
  providers: [],
})
export class CollectionsModule {}
