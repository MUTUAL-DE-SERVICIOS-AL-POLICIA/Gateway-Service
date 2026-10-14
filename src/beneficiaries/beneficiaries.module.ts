import { Module } from '@nestjs/common';
import { AffiliatesController } from './affiliates.controller';
import { PersonsController } from './persons.controller';
import { ReportsController } from './reports.controller';

@Module({
  controllers: [AffiliatesController, PersonsController, ReportsController],
  providers: [],
  imports: [],
})
export class BeneficiariesModule {}
