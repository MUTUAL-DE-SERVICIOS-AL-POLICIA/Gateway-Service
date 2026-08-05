import { Module } from '@nestjs/common';
import { ReportsModule } from 'src/reports/reports.module';
import { SalesController } from './sales.controller';

@Module({
  imports: [ReportsModule],
  controllers: [SalesController],
  providers: [],
})
export class SalesModule {}
