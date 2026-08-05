import { Content, TDocumentDefinitions } from "pdfmake/interfaces";
import {
  SalesListData,
  SalesListItem,
} from "../../../interfaces/sales/sales-list-data.interface";
import {
  buildSalesListHeaderData,
  buildSalesReportHeader,
} from "../cabeceras";

const PAGE_WIDTH = 792;
const PAGE_HORIZONTAL_MARGIN = 40;
const PAGE_FOOTER_MARGIN = 42;

const HEADER_TOP_MARGIN = 28;
const CONTENT_TOP_MARGIN = 105;
const AVAILABLE_PAGE_WIDTH = PAGE_WIDTH - PAGE_HORIZONTAL_MARGIN * 2;

const COLORS = {
  primary: "#4A4A4A",
  primaryDark: "#1F1F1F",
  headerText: "#FFFFFF",
  text: "#202020",
  muted: "#666666",
  grid: "#C8C8C8",
  alternateRow: "#F2F2F2",
  emptyRow: "#F8F8F8",
};

/**
 * Los anchos suman 630 puntos.
 * El espacio restante se utiliza para padding y bordes de PDFMake.
 */
const SALES_TABLE_WIDTHS = [
  48, // Código
  68, // Fecha y hora
  142, // Titular
  124, // Servicio
  32, // Cantidad
  40, // Precio
  64, // Tipo de pago
  48, // Total
  70, // Recepcionista
];

export function reportSales(data: SalesListData): TDocumentDefinitions {
  return {
    pageSize: "LETTER",
    pageOrientation: "landscape",

    pageMargins: [
      PAGE_HORIZONTAL_MARGIN,
      CONTENT_TOP_MARGIN,
      PAGE_HORIZONTAL_MARGIN,
      PAGE_FOOTER_MARGIN,
    ],

    header: () => buildPageHeader(data),

    footer: (currentPage: number, pageCount: number) =>
      buildPageFooter(currentPage, pageCount, data),

    defaultStyle: {
      font: "Helvetica",
      fontSize: 7,
      color: COLORS.text,
    },

    content: [buildSalesContent(data.sales)],

    styles: {
      tableHeader: {
        fontSize: 7,
        bold: true,
        color: COLORS.headerText,
        fillColor: COLORS.primary,
        alignment: "center",
      },

      tableCell: {
        fontSize: 6.5,
        color: COLORS.text,
        lineHeight: 1.05,
      },

      sectionTitle: {
        fontSize: 7.5,
        bold: true,
        color: COLORS.primaryDark,
      },

      sectionCounter: {
        fontSize: 6.5,
        color: COLORS.muted,
        alignment: "right",
      },
    },
  };
}

function buildPageHeader(data: SalesListData): Content {
  return {
    margin: [
      PAGE_HORIZONTAL_MARGIN,
      HEADER_TOP_MARGIN,
      PAGE_HORIZONTAL_MARGIN,
      0,
    ],

    stack: [
      buildSalesReportHeader({
        ...buildSalesListHeaderData(data),

        pageWidth: PAGE_WIDTH,

        pageHorizontalMargin: PAGE_HORIZONTAL_MARGIN,
      }),
    ],
  } as Content;
}

function buildPageFooter(
  currentPage: number,
  pageCount: number,
  data: SalesListData
): Content {
  return {
    margin: [PAGE_HORIZONTAL_MARGIN, 7, PAGE_HORIZONTAL_MARGIN, 0],

    stack: [
      {
        canvas: [
          {
            type: "line",
            x1: 0,
            y1: 0,
            x2: AVAILABLE_PAGE_WIDTH,
            y2: 0,
            lineWidth: 0.5,
            lineColor: COLORS.grid,
          },
        ],

        margin: [0, 0, 0, 5],
      },

      {
        columns: [
          {
            width: "*",

            text: [
              {
                text: "Cantidad de registros: ",
                bold: true,
                color: COLORS.primaryDark,
              },

              {
                text: String(data.totalItems),
                color: COLORS.muted,
              },
            ],

            fontSize: 6.5,
          },

          {
            width: 120,

            text: `Página ${currentPage} de ${pageCount}`,

            alignment: "right",
            fontSize: 6.5,
            color: COLORS.muted,
          },
        ],
      },
    ],
  } as Content;
}

function buildSalesContent(sales: SalesListItem[]): Content {
  return {
    stack: [buildSalesTable(sales)],
  } as Content;
}

function buildSalesTable(sales: SalesListItem[]): Content {
  
  const body: unknown[][] = [
    [
      headerCell("CÓDIGO"),
      headerCell("FECHA - HORA"),
      headerCell("TITULAR"),
      headerCell("SERVICIO"),
      headerCell("CANT."),
      headerCell("PRECIO"),
      headerCell("TIPO PAGO"),
      headerCell("TOTAL"),
      headerCell("RECEPCIONISTA"),
    ],

    ...sales.map((sale, index) => rowCells(sale, index)),
  ];

  if (sales.length === 0) {
    body.push([
      {
        text: "No existen ventas registradas para el rango de fechas seleccionado.",

        colSpan: 9,
        alignment: "center",
        fontSize: 7,
        color: COLORS.muted,
        fillColor: COLORS.emptyRow,

        margin: [4, 8, 4, 8],
      },

      {},
      {},
      {},
      {},
      {},
      {},
      {},
      {},
    ]);
  }

  return {
    margin: [0, 0, 0, 0],

    table: {
      headerRows: 1,
      widths: SALES_TABLE_WIDTHS,
      body,
      dontBreakRows: true,
      keepWithHeaderRows: 1,
    },

    layout: {
      hLineWidth: (rowIndex: number, node: any) => {
        const lastRow = node.table.body.length;

        if (rowIndex === 0 || rowIndex === 1 || rowIndex === lastRow) {
          return 0.7;
        }

        return 0.35;
      },

      vLineWidth: (columnIndex: number, node: any) => {
        const lastColumn = node.table.widths.length;

        if (columnIndex === 0 || columnIndex === lastColumn) {
          return 0.7;
        }

        return 0.35;
      },

      hLineColor: (rowIndex: number) => {
        return rowIndex <= 1 ? COLORS.primaryDark : COLORS.grid;
      },

      vLineColor: () => COLORS.grid,

      paddingLeft: () => 4,

      paddingRight: () => 4,

      paddingTop: (rowIndex: number) => (rowIndex === 0 ? 4 : 3.2),

      paddingBottom: (rowIndex: number) => (rowIndex === 0 ? 4 : 3.2),
    },
  } as Content;
}

function headerCell(text: string) {
  return {
    text,
    style: "tableHeader",
    alignment: "center",
    noWrap: true,
  };
}

function rowCells(sale: SalesListItem, index: number) {
  const fillColor = index % 2 === 0 ? null : COLORS.alternateRow;

  return [
    cell(sale.code, "center", true),

    cell(formatDateTime(sale.receptionDate), "center", true),

    cell(sale.principalCustomer, "left", true),

    cell(sale.service, "left", true),

    cell(String(sale.amount), "center", true),

    cell(sale.price, "center", true),

    cell(sale.paymentType, "center", true),

    cell(sale.total, "right", true),

    cell(sale.receptionist, "center"),
  ].map((value) => ({
    ...value,
    fillColor,
  }));
}

function cell(
  text: string | null | undefined,
  alignment: "left" | "center" | "right" = "left",
  noWrap = false
) {
  return {
    text: fallback(text),

    style: "tableCell",

    alignment,

    noWrap,
  };
}

function formatDateTime(value: string | Date | null | undefined): string {
  const date = parseDate(value);

  if (!date) {
    return "-";
  }

  return new Intl.DateTimeFormat("es-BO", {
    day: "2-digit",

    month: "2-digit",

    year: "numeric",

    hour: "2-digit",

    minute: "2-digit",

    hour12: false,
  }).format(date);
}

function parseDate(value: string | Date | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function fallback(value: string | null | undefined): string {
  const normalized = value?.trim();

  return normalized ? normalized : "-";
}
