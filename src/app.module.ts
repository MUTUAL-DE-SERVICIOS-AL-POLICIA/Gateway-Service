import { Module } from '@nestjs/common';
import { BeneficiariesModule } from './beneficiaries/beneficiaries.module';
import { AuthModule } from './auth/auth.module';
import { KioskModule } from './kiosk/kiosk.module';
import { CommonModule } from './common/common.module';
import { DatabaseModule } from './database/database.module';
import { PvtBeModule } from './pvt-be/pvt-be.module';
import { PvtStiModule } from './pvt-sti/pvt-sti.module';
import { AppMobileModule } from './app-mobile/app-mobile.module';
import { RecordsModule } from './records/records.module';

@Module({
  imports: [
    AuthModule,
    BeneficiariesModule,
    KioskModule,
    CommonModule,
    DatabaseModule,
    PvtBeModule,
    PvtStiModule,
    AppMobileModule,
    RecordsModule,
  ],
})
export class AppModule {}
