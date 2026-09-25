import { Module } from '@nestjs/common';
import { AffiliatesController } from './affiliates.controller';
import { PersonsController } from './persons.controller';
import { WebAuthorizationGuard } from 'src/auth/guards';

@Module({
  controllers: [AffiliatesController, PersonsController],
  providers: [WebAuthorizationGuard],
  imports: [],
})
export class BeneficiariesModule {}
