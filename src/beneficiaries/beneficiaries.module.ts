import { Module } from '@nestjs/common';
import { AffiliatesController } from './affiliates.controller';
import { PersonsController } from './persons.controller';
import { WebAuthorizationGuard } from 'src/auth/web-auth/web-authorization.guard';

@Module({
  controllers: [AffiliatesController, PersonsController],
  providers: [WebAuthorizationGuard],
  imports: [],
})
export class BeneficiariesModule {}
