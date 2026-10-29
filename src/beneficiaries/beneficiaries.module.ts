import { Module } from '@nestjs/common';
import { AffiliatesController } from './affiliates.controller';
import { PersonsController } from './persons.controller';
import { PvtImportApiKeyGuard, WebAuthorizationGuard } from 'src/auth/guards';
import { PvtDocumentImportController } from './pvt-document-import.controller';
import { ReportsController } from './reports.controller';

@Module({
  controllers: [
    AffiliatesController,
    PersonsController,
    PvtDocumentImportController,
    ReportsController,
  ],
  providers: [WebAuthorizationGuard, PvtImportApiKeyGuard],
  imports: [],
})
export class BeneficiariesModule {}
