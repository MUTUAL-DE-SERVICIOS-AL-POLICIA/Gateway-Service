import { TDocumentDefinitions } from 'pdfmake/interfaces';

export interface ReportRenderer {
  generatePdfBuffer(documentDefinition: TDocumentDefinitions): Promise<Buffer>;
}
