import { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import { buildHeader, HeaderData } from '../header';
import { buildFooter } from '../footer';

export interface SalesReportItem {
  'FECHA Y HORA': string;
  CÓDIGO: string;
  'NOMBRE COMPLETO': string;
  DESCRIPCIÓN: string;
  TOTAL: string;
  'TIPO DE PAGO': string;
  RECEPCIONISTA: string;
}

interface SalesReportPdfData {
  header: HeaderData;
  reportData: SalesReportItem[];
}

// Paleta Monocromática (Negro y Grises)
const COLORS = {
  textDark: '#111111',
  textMuted: '#444444',
  headerBg: '#5c5c5c',        // Gris oscuro para cabecera de tabla
  headerText: '#FFFFFF',
  zebraBg: '#F7FAFC',         // Gris muy claro para filas alternas
  totalBg: '#797878',         // Gris medio para el totalizador
  border: '#CBD5E0',          // Gris sutil para bordes
};

export function reportSales(data: SalesReportPdfData): TDocumentDefinitions {
  const items = data.reportData || [];

  const tableHeaders = [
    'FECHA Y HORA',
    'CÓDIGO',
    'NOMBRE COMPLETO',
    'DESCRIPCIÓN',
    'TIPO DE PAGO',
    'RECEPCIONISTA',
    'TOTAL',
  ];

  const tableRows = items.map((item, index) => {
    const isEven = index % 2 === 0;
    const background = isEven ? '#FFFFFF' : COLORS.zebraBg;

    return [
      { text: item['FECHA Y HORA'] || '', fontSize: 5.5, alignment: 'center', fillColor: background },
      { text: item['CÓDIGO'] || '', fontSize: 5.5, alignment: 'center', bold: true, fillColor: background },
      { text: item['NOMBRE COMPLETO'] || '', fontSize: 5.5, fillColor: background },
      { text: item['DESCRIPCIÓN'] || '', fontSize: 5.5, fillColor: background },
      { text: item['TIPO DE PAGO'] || '', fontSize: 5.5, alignment: 'center', fillColor: background },
      { text: item['RECEPCIONISTA'] || '', fontSize: 5.5, alignment: 'center', fillColor: background },
      { text: item['TOTAL'] || '', fontSize: 5.5, alignment: 'right', fillColor: background },
    ];
  });

  const grandTotal = items.reduce(
    (acc, curr) => acc + (parseFloat(curr.TOTAL) || 0),
    0,
  );

  const totalRow = [
    {
      text: 'TOTAL',
      colSpan: 6,
      bold: true,
      fontSize: 6,
      alignment: 'right',
      fillColor: COLORS.zebraBg,
      color: COLORS.textDark,
    },
    {}, {}, {}, {}, {},
    {
      text: grandTotal.toFixed(2),
      bold: true,
      fontSize: 6,
      alignment: 'right',
      fillColor: COLORS.zebraBg,
      color: COLORS.textDark,
    },
  ];

  return {
    pageSize: 'LETTER',
    pageMargins: [20, 20, 20, 20],

    defaultStyle: {
      font: 'Helvetica',
      color: COLORS.textDark,
    },

    footer: (currentPage, pageCount) => ({
      columns: [
        {
          text: `Página ${currentPage} de ${pageCount}`,
          alignment: 'center',
          fontSize: 8,
        },
      ],
    }),

    content: [
      buildHeader(data.header),
      {
        text: '(Expresado en Bolivianos)',
        alignment: 'center',
        italics: true,
        fontSize: 6.5,
        color: COLORS.textMuted,
        margin: [0, 4, 0, 2],
      },
      
      {
        margin: [0, 0, 0, 0],
        table: {
          headerRows: 1,
          widths: ['12%', '13%', '24%', '20%', '11%', '12%', '8%'],
          body: [
            tableHeaders.map((headerText) => ({
              text: headerText,
              bold: true,
              fontSize: 6,
              color: COLORS.headerText,
              fillColor: COLORS.headerBg,
              alignment: headerText === 'TOTAL' ? 'right' : 'center',
            })),
            ...tableRows,
            totalRow,
          ],
        },
        layout: {
          hLineWidth: (i, node) =>
            i === 0 || i === 1 || i === node.table.body.length ? 0.6 : 0.3,
          vLineWidth: () => 0.3,
          hLineColor: () => COLORS.border,
          vLineColor: () => COLORS.border,
          paddingLeft: () => 3,
          paddingRight: () => 3,
          paddingTop: () => 3,
          paddingBottom: () => 3,
        },
      },
    ] as Content[],
  };
}