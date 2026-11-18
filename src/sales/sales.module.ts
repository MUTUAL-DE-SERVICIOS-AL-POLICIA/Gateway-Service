import { Module } from '@nestjs/common';
import { SalesController } from './sales.controller';
import { SalesPersonsController } from './sales-persons.controller';
import { WebAuthorizationGuard } from 'src/auth/guards';

@Module({
  controllers: [SalesPersonsController, SalesController],
  providers: [WebAuthorizationGuard],
})
export class SalesModule {}
