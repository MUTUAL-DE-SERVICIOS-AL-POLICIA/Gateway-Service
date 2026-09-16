import { Injectable } from '@nestjs/common';
import pdfMake from 'pdfmake';
import { TDocumentDefinitions } from 'pdfmake/interfaces';

@Injectable()
export class PdfBufferService {
  constructor() {
    pdfMake.addFonts({
      Helvetica: {
        normal: 'Helvetica',
        bold: 'Helvetica-Bold',
        italics: 'Helvetica-Oblique',
        bolditalics: 'Helvetica-BoldOblique',
      },
    });

    pdfMake.setLocalAccessPolicy((path) =>
      [
        'Helvetica',
        'Helvetica-Bold',
        'Helvetica-Oblique',
        'Helvetica-BoldOblique',
      ].includes(path),
    );

    pdfMake.setUrlAccessPolicy(() => false);
  }

  async generatePdfBuffer(
    documentDefinition: TDocumentDefinitions,
  ): Promise<Buffer> {
    const pdf = pdfMake.createPdf({
      defaultStyle: {
        font: 'Helvetica',
      },
      ...documentDefinition,
    });

    return pdf.getBuffer();
  }
}