import { Module } from '@nestjs/common';
import { AffiliatesController } from './affiliates.controller';
import { PersonsController } from './persons.controller';

@Module({
  controllers: [AffiliatesController, PersonsController],
  providers: [],
  imports: [],
})
export class BeneficiariesModule {}
