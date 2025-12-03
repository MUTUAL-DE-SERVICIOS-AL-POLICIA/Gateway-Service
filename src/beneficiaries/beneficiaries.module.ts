import { Module } from '@nestjs/common';
import { AffiliatesController } from './affiliates.controller';
import { PersonsController } from './persons.controller';
import { BeneficiariesController } from './beneficiaries.controller';

@Module({
  controllers: [AffiliatesController, PersonsController, BeneficiariesController],
  providers: [],
  imports: [],
})
export class BeneficiariesModule {}
