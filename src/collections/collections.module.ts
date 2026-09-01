import { Module } from '@nestjs/common';
import { TransactionsController } from './transactions.controller';
import { BankStatementsController } from './bank-statements.controller';

@Module({
  controllers: [TransactionsController, BankStatementsController],
  providers: [],
})
export class CollectionsModule {}
