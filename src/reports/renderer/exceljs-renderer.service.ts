import { Injectable } from '@nestjs/common';
import { Workbook } from 'exceljs';
import { SpreadsheetRenderer } from './spreadsheet-renderer.interface';

@Injectable()
export class ExceljsRendererService implements SpreadsheetRenderer {
  async generateXlsxBuffer(workbook: Workbook): Promise<Buffer> {
    const data = await workbook.xlsx.writeBuffer();

    return Buffer.from(data);
  }
}
