import { Injectable } from '@nestjs/common';
import { ReportFileResult } from '../interfaces/common/report-file-result.interface';
import { PDF_CONTENT_TYPE, XLSX_CONTENT_TYPE } from '../interfaces/common/report-format.type';
import { SalesListData } from '../interfaces/sales/sales-list-data.interface';
import { SalesReceiptData } from '../interfaces/sales/sales-receipt-data.interface';
import { ExceljsRendererService } from '../renderer/exceljs-renderer.service';
import { PdfmakeRendererService } from '../renderer/pdfmake-renderer.service';
import { buildSalesHeaderPreview, SalesHeaderPreviewData } from '../templates/sales/cabeceras';
import { reciboFormal } from '../templates/sales/receipts/reciboFormalPdf';
import { reportSalesExcel } from '../templates/sales/reports/reportSalesExcel';
import { reportSales } from '../templates/sales/reports/reportSalesPdf';
import { buildReceiptFileName, buildSalesListFileName } from '../utils/report-file-name.util';

@Injectable()
export class ReportsSalesService {
  constructor(
    private readonly pdfMake: PdfmakeRendererService,
    private readonly exceljs: ExceljsRendererService,
  ) {}

  async generateSalesHeaderPreview(): Promise<ReportFileResult> {
    const previewData: SalesHeaderPreviewData = {
      institutionName: 'MUTUAL DE SERVICIOS AL POLICÍA',
      institutionShortName: 'MUSERPOL',
      title: 'REPORTE GENERAL DE VENTAS',
      generatedAt: new Date(),
      dateFrom: '2026-07-01T00:00:00-04:00',
      dateTo: '2026-07-10T23:59:59-04:00',
      description: 'Vista previa de cabecera reutilizable para reportes de ventas.',
    };

    const documentDefinition = buildSalesHeaderPreview(previewData);
    const buffer = await this.pdfMake.generatePdfBuffer(documentDefinition);

    return {
      buffer,
      fileName: 'sales-report-header-preview.pdf',
      contentType: PDF_CONTENT_TYPE,
      disposition: 'inline',
    };
  }

  async generateSalesReceiptPdf(data: SalesReceiptData): Promise<ReportFileResult> {
    const documentDefinition = reciboFormal(data);
    const buffer = await this.pdfMake.generatePdfBuffer(documentDefinition);
    const receiptNumber = data.sale.code;

    return {
      buffer,
      fileName: buildReceiptFileName(receiptNumber),
      contentType: PDF_CONTENT_TYPE,
      disposition: 'inline',
    };
  }

  async generateSalesListPdf(data: SalesListData): Promise<ReportFileResult> {
    const documentDefinition = reportSales(data);
    const buffer = await this.pdfMake.generatePdfBuffer(documentDefinition);

    return {
      buffer,
      fileName: buildSalesListFileName(data.filters.dateFrom, data.filters.dateTo, 'pdf'),
      contentType: PDF_CONTENT_TYPE,
      disposition: 'inline',
    };
  }

  async generateSalesListXlsx(data: SalesListData): Promise<ReportFileResult> {
    const workbook = reportSalesExcel(data);
    const buffer = await this.exceljs.generateXlsxBuffer(workbook);

    return {
      buffer,
      fileName: buildSalesListFileName(data.filters.dateFrom, data.filters.dateTo, 'xlsx'),
      contentType: XLSX_CONTENT_TYPE,
      disposition: 'attachment',
    };
  }
}
