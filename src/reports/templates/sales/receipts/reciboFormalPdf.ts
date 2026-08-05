import { Content, ContentColumns, TDocumentDefinitions } from 'pdfmake/interfaces';
import {
  SalesReceiptData,
  SaleProducts,
} from '../../../interfaces/sales/sales-receipt-data.interface';
import { formatSpanishDate } from '../../../utils/report-date.util';

const PAGE = {
  width: 612,
  height: 792,
  margin: 36,
};

const HALF_PAGE_HEIGHT = PAGE.height / 2;

const RECEIPT = {
  width: PAGE.width - PAGE.margin * 2,

  height: HALF_PAGE_HEIGHT - PAGE.margin * 2,
};

const RECEIPT_PADDING = {
  left: 14,
  top: 10,
  right: 14,
  bottom: 10,
};

const RECEIPT_BODY_HEIGHT = RECEIPT.height - RECEIPT_PADDING.top - RECEIPT_PADDING.bottom;

const RECEIPT_FOOTER_HEIGHT = 58;

const RECEIPT_MAIN_HEIGHT = RECEIPT_BODY_HEIGHT - RECEIPT_FOOTER_HEIGHT;

const CUT_LINE_WIDTH = PAGE.width - PAGE.margin * 2;

const SIGNATURE_BOX_WIDTH = 168;

const COLORS = {
  primary: '#4A4A4A',
  primaryDark: '#1F1F1F',
  primarySoft: '#E6E6E6',
  primarySoftAlt: '#F2F2F2',

  text: '#202020',
  muted: '#666666',

  border: '#C8C8C8',
  borderStrong: '#8A8A8A',

  white: '#FFFFFF',
  rowAlternate: '#F5F5F5',
};

export function reciboFormal(data: SalesReceiptData): TDocumentDefinitions {
  const receiptX = PAGE.margin;

  const topReceiptY = PAGE.margin;

  const separatorY = HALF_PAGE_HEIGHT;

  const bottomReceiptY = HALF_PAGE_HEIGHT + PAGE.margin;

  return {
    pageSize: 'LETTER',
    pageMargins: [0, 0, 0, 0],
    defaultStyle: {
      font: 'Helvetica',
      fontSize: 7,
      color: COLORS.text,
    },

    content: [
      {
        ...buildReceiptCopy(data),

        absolutePosition: {
          x: receiptX,
          y: topReceiptY,
        },
      } as unknown as Content,

      {
        ...buildCutSeparator(CUT_LINE_WIDTH),

        absolutePosition: {
          x: PAGE.margin,
          y: separatorY - 4,
        },
      } as Content,

      {
        ...buildReceiptCopy(data),

        absolutePosition: {
          x: receiptX,
          y: bottomReceiptY,
        },
      } as unknown as Content,
    ],

    styles: {
      institution: {
        fontSize: 7.5,
        bold: true,
        alignment: 'center',
        color: COLORS.text,
      },

      institutionSub: {
        fontSize: 7,
        bold: true,
        alignment: 'center',
        color: COLORS.primary,
      },

      title: {
        fontSize: 13.5,
        bold: true,
        alignment: 'center',
        color: COLORS.primaryDark,
      },

      titleSub: {
        fontSize: 6.4,
        alignment: 'center',
        color: COLORS.muted,
      },

      saleCodeLabel: {
        fontSize: 5.8,
        bold: true,
        alignment: 'right',
        color: COLORS.muted,
      },

      saleCodeValue: {
        fontSize: 9.5,
        bold: true,
        alignment: 'right',
        color: COLORS.primaryDark,
      },

      mainLabel: {
        fontSize: 6.4,
        bold: true,
        color: COLORS.primaryDark,
        fillColor: COLORS.primarySoft,
      },

      mainValue: {
        fontSize: 6.8,
        color: COLORS.text,
      },

      sectionTitle: {
        fontSize: 6.8,
        bold: true,
        color: COLORS.primaryDark,
      },

      tableHeader: {
        fontSize: 6.3,
        bold: true,
        alignment: 'center',
        color: COLORS.white,
        fillColor: COLORS.primary,
      },

      tableCell: {
        fontSize: 6.25,
        color: COLORS.text,
      },

      tableCellCenter: {
        fontSize: 6.25,
        alignment: 'center',
        color: COLORS.text,
      },

      tableCellRight: {
        fontSize: 6.25,
        alignment: 'right',
        color: COLORS.text,
      },

      totalLabel: {
        fontSize: 7,
        bold: true,
        alignment: 'right',
        color: COLORS.primaryDark,
      },

      totalValue: {
        fontSize: 10,
        bold: true,
        alignment: 'right',
        color: COLORS.primaryDark,
      },

      signature: {
        fontSize: 6.5,
        bold: true,
        alignment: 'center',
        color: COLORS.primaryDark,
      },

      signatureName: {
        fontSize: 6.3,
        alignment: 'center',
        color: COLORS.text,
      },

      footerText: {
        fontSize: 5.9,
        color: COLORS.text,
      },

      metadata: {
        fontSize: 4.8,
        color: COLORS.muted,
      },
    },
  };
}

function buildReceiptCopy(data: SalesReceiptData) {
  return {
    table: {
      widths: [RECEIPT.width],
      heights: [RECEIPT.height],

      body: [
        [
          {
            border: [true, true, true, true],

            margin: [
              RECEIPT_PADDING.left,
              RECEIPT_PADDING.top,
              RECEIPT_PADDING.right,
              RECEIPT_PADDING.bottom,
            ],

            stack: [
              buildTopAccent(),

              {
                table: {
                  widths: ['*'],
                  heights: [RECEIPT_MAIN_HEIGHT, RECEIPT_FOOTER_HEIGHT],

                  body: [
                    [
                      {
                        border: [false, false, false, false],

                        stack: [
                          buildHeader(data),
                          buildMainInformation(data),
                          buildProductsBlock(data),
                        ],
                      },
                    ],

                    [
                      {
                        border: [false, false, false, false],

                        stack: [buildSignatureBlock(data), buildFooter(data)],
                      },
                    ],
                  ],
                },

                layout: noPaddingLayout(),
              },
            ],
          },
        ],
      ],
    },

    layout: outerBorderLayout(),

    unbreakable: true,
  };
}

function buildTopAccent(): Content {
  return {
    canvas: [
      {
        type: 'rect',
        x: 0,
        y: 0,
        w: RECEIPT.width - RECEIPT_PADDING.left - RECEIPT_PADDING.right,
        h: 3,
        color: COLORS.primary,
      },
    ],

    margin: [0, 0, 0, 5],
  } as Content;
}

function buildHeader(data: SalesReceiptData): Content {
  return {
    table: {
      widths: [170, '*', 145],

      body: [
        [
          {
            border: [false, false, false, false],

            margin: [0, 3, 8, 3],

            stack: [
              {
                text: 'MUTUAL DE SERVICIOS AL POLICIA',
                style: 'institution',
              },

              {
                text: '"MUSERPOL"',
                style: 'institutionSub',
                margin: [0, 1, 0, 0],
              },
            ],
          },

          {
            border: [false, false, false, false],

            margin: [6, 0, 6, 0],

            stack: [
              {
                text: 'RECIBO',
                style: 'title',
              },
              {
                text: 'COMPROBANTE DE PAGO',
                style: 'titleSub',
                margin: [0, 1, 0, 0],
              },
            ],
          },

          {
            border: [false, false, false, false],
            margin: [8, 4, 0, 0],
            text: `Nº ${saleCode(data)}`,
            style: 'saleCodeValue',
          },
        ],
      ],
    },

    layout: noPaddingLayout(),

    margin: [0, 0, 0, 5],
  } as Content;
}

function buildMainInformation(data: SalesReceiptData): Content {
  return {
    table: {
      widths: [76, '*', 70, 112],

      body: [
        [
          mainLabelCell('TITULAR'),

          {
            text: `${customerName(data)}  ·  CI ${customerCi(data)}`,
            style: 'mainValue',
            colSpan: 3,
            verticalAlignment: 'middle',
          },
          {},
          {},
        ],

        [
          mainLabelCell('PAGADO POR'),

          {
            text: `${payerName(data)}  ·  CI ${payerCi(
              data,
            )}  ·  Tercero: ${yesNo(data.payer.isThirdParty)}`,
            style: 'mainValue',
            colSpan: 3,
            verticalAlignment: 'middle',
          },

          {},
          {},
        ],

        [
          mainLabelCell('POR LA SUMA DE'),

          {
            text: amountToLiteral(totalAmount(data)),
            style: 'mainValue',
            colSpan: 3,
            bold: true,
            verticalAlignment: 'middle',
          },

          {},
          {},
        ],

        [

          mainLabelCell('DESDE LA ENTIDAD'),

          {
            text: paymentLocation(data),
            style: 'mainValue',
            alignment: 'left',
            verticalAlignment: 'middle',
          },

          mainLabelCell('FORMA DE PAGO'),

          {
            text: paymentType(data),
            style: 'mainValue',
            verticalAlignment: 'middle',
          },
          
        ],
      ],
    },

    layout: mainTableLayout(),
  } as Content;
}

function mainLabelCell(text: string) {
  return {
    text,
    style: 'mainLabel',
    alignment: 'right',
    verticalAlignment: 'middle',
  };
}

function buildProductsBlock(data: SalesReceiptData): Content {
  const showFolderNumber = data.products.some(isFolderProduct);
  const headerRow: unknown[] = [
    {
      text: 'POR CONCEPTO DE',
      style: 'tableHeader',
      alignment: 'left',
    },
  ];

  if (showFolderNumber) {
    headerRow.push({
      text: 'NRO DE FOLDER',
      style: 'tableHeader',
      alignment: 'center',
    });
  }

  headerRow.push(
    {
      text: 'CANT.',
      style: 'tableHeader',
    },
    {
      text: 'P. UNIT.',
      style: 'tableHeader',
      alignment: 'right',
    },
    {
      text: 'SUBTOTAL',
      style: 'tableHeader',
      alignment: 'right',
    },
  );

  const body: unknown[][] = [
    headerRow,

    ...data.products.map((product, index) => productRow(product, index, showFolderNumber)),
  ];

  if (data.products.length === 0) {
    const columnCount = showFolderNumber ? 5 : 4;

    body.push([
      {
        text: 'Sin servicios registrados.',
        style: 'tableCell',
        alignment: 'center',

        colSpan: columnCount,
        margin: [0, 3, 0, 3],
      },

      {},
      {},
      {},
      ...(showFolderNumber ? [{}] : []),
    ]);
  }

  return {
    margin: [0, 5, 0, 0],

    stack: [
      {
        table: {
          headerRows: 1,
          widths: showFolderNumber ? ['*', 76, 38, 58, 64] : ['*', 38, 58, 64],
          body,
          dontBreakRows: true,
        },
        layout: productsTableLayout(),
      },

      buildTotalBlock(data),
    ],
  } as Content;
}

function buildTotalBlock(data: SalesReceiptData): Content {
  return {
    margin: [0, 4, 0, 0],

    table: {
      widths: ['*', 88, 100],

      body: [
        [
          {
            text: '',
            border: [false, false, false, false],
          },

          {
            text: 'TOTAL PAGADO',
            style: 'totalLabel',
            fillColor: COLORS.primarySoft,
            border: [true, true, false, true],
            margin: [4, 4, 4, 4],
          },

          {
            text: money(data.voucher.total, data.currency.symbol),
            style: 'totalValue',
            fillColor: COLORS.primarySoft,
            border: [false, true, true, true],
            margin: [4, 2.5, 5, 2.5],
          },
        ],
      ],
    },

    layout: totalTableLayout(),
  } as Content;
}

function productRow(product: SaleProducts, index: number, showFolderNumber: boolean) {
  const fillColor = index % 2 === 0 ? COLORS.white : COLORS.rowAlternate;

  const row: unknown[] = [
    {
      text: fallback(product.name),
      style: 'tableCell',
      fillColor,
    },
  ];

  if (showFolderNumber) {
    row.push({
      text: isFolderProduct(product) ? folderNumbers(product) : '-',
      style: 'tableCell',
      fillColor,
    });
  }

  row.push(
    {
      text: fallback(product.amount),
      style: 'tableCellCenter',
      fillColor,
    },

    {
      text: money(product.price),
      style: 'tableCellRight',
      fillColor,
    },

    {
      text: money(product.total),
      style: 'tableCellRight',
      fillColor,
    },
  );

  return row;
}

function isFolderProduct(product: SaleProducts): boolean {
  return product.groupName?.trim().toLowerCase() === 'folders';
}

function folderNumbers(product: SaleProducts): string {
  const fileNumbers = Array.isArray(product.fileNumbers) ? product.fileNumbers.filter(Boolean) : [];

  return fileNumbers.length > 0 ? fileNumbers.join(', ') : '-';
}

function buildSignatureBlock(data: SalesReceiptData): Content {
  return {
    margin: [0, 0, 0, 6],

    columns: [
      {
        width: '*',
        text: '',
      },

      buildSignatureBox('COBRADO POR', fallback(data.sale.receptionist)),

      {
        width: 34,
        text: '',
      },

      buildSignatureBox('PAGADO POR', payerName(data)),

      {
        width: '*',
        text: '',
      },
    ],
  } as Content;
}

function buildSignatureBox(title: string, name: string): Content {
  return {
    width: SIGNATURE_BOX_WIDTH,

    stack: [
      buildSignatureLine(SIGNATURE_BOX_WIDTH),

      {
        text: title,
        style: 'signature',
        margin: [0, 2, 0, 0],
      },

      {
        text: fitSignatureName(name),
        style: 'signatureName',
        margin: [0, 1, 0, 0],
      },
    ],
  } as Content;
}

function buildSignatureLine(width: number): Content {
  return {
    canvas: [
      {
        type: 'line',
        x1: 0,
        y1: 0,
        x2: width,
        y2: 0,
        lineWidth: 0.55,
        lineColor: COLORS.primaryDark,
      },
    ],

    margin: [0, 0, 0, 2],
  } as Content;
}

function buildFooter(data: SalesReceiptData): Content {
  return {
    stack: [
      {
        canvas: [
          {
            type: 'line',
            x1: 0,
            y1: 0,
            x2: RECEIPT.width - RECEIPT_PADDING.left - RECEIPT_PADDING.right,
            y2: 0,
            lineWidth: 0.4,
            lineColor: COLORS.border,
          },
        ],

        margin: [0, 2, 0, 4],
      },

      {
        text: [
          {
            text: 'Fecha de emisión: ',
            bold: true,
            color: COLORS.primaryDark,
          },
          {
            text: formatSpanishDate(receiptDate(data)),
          },
        ],
        style: 'footerText',
      },

      {
        text: metadataText(data),
        style: 'metadata',
        margin: [0, 2, 0, 0],
      },
    ],
  } as Content;
}

function buildCutSeparator(width: number): ContentColumns {
  const labelWidth = 42;

  const lineWidth = (width - labelWidth) / 2;

  return {
    columns: [
      {
        width: lineWidth,

        canvas: [
          {
            type: 'line',
            x1: 0,
            y1: 4,
            x2: lineWidth - 6,
            y2: 4,
            lineWidth: 0.45,
            dash: {
              length: 3,
              space: 3,
            },
            lineColor: COLORS.borderStrong,
          },
        ],
      },

      {
        width: labelWidth,
        text: 'CORTE',
        alignment: 'center',
        fontSize: 5.5,
        bold: true,
        color: COLORS.muted,
      },

      {
        width: lineWidth,

        canvas: [
          {
            type: 'line',
            x1: 6,
            y1: 4,
            x2: lineWidth,
            y2: 4,
            lineWidth: 0.45,
            dash: {
              length: 3,
              space: 3,
            },
            lineColor: COLORS.borderStrong,
          },
        ],
      },
    ],
  } as ContentColumns;
}

function outerBorderLayout() {
  return {
    hLineColor: () => COLORS.primaryDark,
    vLineColor: () => COLORS.primaryDark,
    hLineWidth: () => 0.8,
    vLineWidth: () => 0.8,
    paddingLeft: () => 0,
    paddingRight: () => 0,
    paddingTop: () => 0,
    paddingBottom: () => 0,
  };
}

function noPaddingLayout() {
  return {
    hLineWidth: () => 0,
    vLineWidth: () => 0,
    paddingLeft: () => 0,
    paddingRight: () => 0,
    paddingTop: () => 0,
    paddingBottom: () => 0,
  };
}

function mainTableLayout() {
  return {
    hLineColor: () => COLORS.borderStrong,
    vLineColor: () => COLORS.borderStrong,
    hLineWidth: () => 0.4,
    vLineWidth: () => 0.4,
    paddingLeft: () => 4,
    paddingRight: () => 4,
    paddingTop: () => 2.2,
    paddingBottom: () => 2.2,
  };
}

function productsTableLayout() {
  return {
    hLineColor: (rowIndex: number) => (rowIndex <= 1 ? COLORS.primaryDark : COLORS.border),
    vLineColor: () => COLORS.border,
    hLineWidth: (rowIndex: number) => (rowIndex <= 1 ? 0.55 : 0.3),
    vLineWidth: () => 0.3,
    paddingLeft: () => 3,
    paddingRight: () => 3,
    paddingTop: (rowIndex: number) => (rowIndex === 0 ? 2.5 : 1.8),
    paddingBottom: (rowIndex: number) => (rowIndex === 0 ? 2.5 : 1.8),
  };
}

function totalTableLayout() {
  return {
    hLineColor: () => COLORS.borderStrong,
    vLineColor: () => COLORS.borderStrong,
    hLineWidth: () => 0.5,
    vLineWidth: () => 0.5,
    paddingLeft: () => 0,
    paddingRight: () => 0,
    paddingTop: () => 0,
    paddingBottom: () => 0,
  };
}

function saleCode(data: SalesReceiptData): string {
  return fallback(data.sale.code);
}

function totalAmount(data: SalesReceiptData): string {
  return data.voucher.total ?? data.totals.amount ?? '0.00';
}

function customerName(data: SalesReceiptData): string {
  return data.principalCustomer.fullName ?? 'SIN NOMBRE';
}

function customerCi(data: SalesReceiptData): string {
  return data.principalCustomer.identityCard ?? 'SIN CI';
}

function payerName(data: SalesReceiptData): string {
  return data.payer.customer ?? data.principalCustomer.fullName ?? 'SIN NOMBRE';
}

function payerCi(data: SalesReceiptData): string {
  return data.payer.identityCardCustomer ?? data.principalCustomer.identityCard ?? 'SIN CI';
}

function paymentType(data: SalesReceiptData): string {
  return data.payment.type?.name ?? 'No especificado';
}

function paymentLocation(data: SalesReceiptData): string {
  return data.voucher.paymentLocation ?? 'No especificado';
}

function receiptDate(data: SalesReceiptData): string | Date {
  return data.voucher.depositDate ?? data.voucher.createdAt ?? data.sale.createdAt;
}

function adminDate(value: string | Date): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return new Intl.DateTimeFormat('es-BO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .format(date)
    .replace(',', '');
}

function money(
  amount: string | null | undefined,

  symbol?: string | null,
): string {
  return `${normalizeCurrency(symbol)} ${amount ?? '0.00'}`.trim();
}

function normalizeCurrency(symbol?: string | null): string {
  const value = (symbol ?? 'Bs.').trim();

  const lower = value.toLowerCase();

  if (lower === 'bs' || lower === 'bs.') {
    return 'Bs.';
  }

  return value;
}

function amountToLiteral(value: string): string {
  const normalized = String(value ?? '0.00')
    .replace(/\s/g, '')
    .replace(/,/g, '');

  const numericValue = Number(normalized);

  if (!Number.isFinite(numericValue)) {
    return '-';
  }

  const integerPart = Math.trunc(numericValue);

  const cents = Math.round(Math.abs(numericValue - integerPart) * 100)
    .toString()
    .padStart(2, '0')
    .slice(0, 2);

  return `${numberToSpanish(integerPart)} ${cents}/100 BOLIVIANOS`;
}

function numberToSpanish(value: number): string {
  if (!Number.isFinite(value)) {
    return '-';
  }

  if (value === 0) {
    return 'CERO';
  }

  if (value < 0) {
    return `MENOS ${numberToSpanish(Math.abs(value))}`;
  }

  if (!Number.isInteger(value)) {
    return String(value).toUpperCase();
  }

  if (value < 1_000_000) {
    return numberToSpanishUnderMillion(value);
  }

  if (value < 1_000_000_000) {
    const millions = Math.floor(value / 1_000_000);

    const rest = value % 1_000_000;

    const prefix =
      millions === 1 ? 'UN MILLON' : `${numberToSpanishUnderMillion(millions)} MILLONES`;

    return rest === 0 ? prefix : `${prefix} ${numberToSpanishUnderMillion(rest)}`;
  }

  return String(value).toUpperCase();
}

function numberToSpanishUnderMillion(value: number): string {
  const units = ['', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];

  const teens = [
    'DIEZ',
    'ONCE',
    'DOCE',
    'TRECE',
    'CATORCE',
    'QUINCE',
    'DIECISEIS',
    'DIECISIETE',
    'DIECIOCHO',
    'DIECINUEVE',
  ];

  const tens = [
    '',
    '',
    'VEINTE',
    'TREINTA',
    'CUARENTA',
    'CINCUENTA',
    'SESENTA',
    'SETENTA',
    'OCHENTA',
    'NOVENTA',
  ];

  const hundreds = [
    '',
    'CIENTO',
    'DOSCIENTOS',
    'TRESCIENTOS',
    'CUATROCIENTOS',
    'QUINIENTOS',
    'SEISCIENTOS',
    'SETECIENTOS',
    'OCHOCIENTOS',
    'NOVECIENTOS',
  ];

  if (value < 10) {
    return units[value];
  }

  if (value < 20) {
    return teens[value - 10];
  }

  if (value < 30) {
    return value === 20 ? 'VEINTE' : `VEINTI${units[value - 20]}`;
  }

  if (value < 100) {
    const unit = value % 10;

    const ten = Math.floor(value / 10);

    return unit === 0 ? tens[ten] : `${tens[ten]} Y ${units[unit]}`;
  }

  if (value === 100) {
    return 'CIEN';
  }

  if (value < 1000) {
    const rest = value % 100;

    const hundred = Math.floor(value / 100);

    return rest === 0
      ? hundreds[hundred]
      : `${hundreds[hundred]} ${numberToSpanishUnderMillion(rest)}`;
  }

  const thousands = Math.floor(value / 1000);

  const rest = value % 1000;

  const prefix = thousands === 1 ? 'MIL' : `${numberToSpanishUnderMillion(thousands)} MIL`;

  return rest === 0 ? prefix : `${prefix} ${numberToSpanishUnderMillion(rest)}`;
}

function yesNo(value: boolean | null | undefined): string {
  if (value === null || value === undefined) {
    return '-';
  }

  return value ? 'Sí' : 'No';
}

function fallback(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '-';
  }

  return String(value);
}

function fitSignatureName(value: string): string {
  const name = fallback(value).replace(/\s+/g, ' ').trim();

  return name.length > 38 ? `${name.slice(0, 35)}...` : name;
}

function metadataText(data: SalesReceiptData): string {
  const metadata = [
    data.metadata?.source ? `Fuente: ${data.metadata.source}` : null,

    data.metadata?.generatedAt ? `Generado en: ${adminDate(data.metadata.generatedAt)}` : null,
  ].filter(Boolean);

  return metadata.length > 0 ? metadata.join('  |  ') : 'Información de generación no disponible.';
}
