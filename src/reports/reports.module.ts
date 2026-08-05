import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ExceljsRendererService } from './renderer/exceljs-renderer.service';
import { PdfmakeRendererService } from './renderer/pdfmake-renderer.service';
import { ReportsSalesService } from './services/reports.sales.service';

@Module({
  controllers: [ReportsController],
  providers: [ReportsSalesService, PdfmakeRendererService, ExceljsRendererService],
  exports: [ReportsSalesService],
})
export class ReportsModule {}
