import { Module } from '@nestjs/common';
import { AffiliatesController } from './affiliates.controller';
import { PersonsController } from './persons.controller';
import { WebPersonsController } from './web-persons.controller';
import { WebAuthorizationGuard } from 'src/auth/web-auth/web-authorization.guard';
import { WebAuthExceptionFilter } from 'src/auth/web-auth/web-auth-exception.filter';

@Module({
  controllers: [AffiliatesController, PersonsController, WebPersonsController],
  providers: [WebAuthorizationGuard, WebAuthExceptionFilter],
  imports: [],
})
export class BeneficiariesModule {}
