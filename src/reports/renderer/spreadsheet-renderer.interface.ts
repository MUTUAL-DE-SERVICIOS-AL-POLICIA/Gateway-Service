import { Workbook } from 'exceljs';

export interface SpreadsheetRenderer {
  generateXlsxBuffer(workbook: Workbook): Promise<Buffer>;
}
