import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { Content, TDocumentDefinitions } from "pdfmake/interfaces";

/**
 * Dimensiones generales.
 *
 * La cabecera se utiliza dentro de una página LETTER horizontal
 * con margen izquierdo y derecho de 40 puntos.
 */
const DEFAULT_PAGE_WIDTH = 792;
const DEFAULT_HORIZONTAL_MARGIN = 40;

/**
 * Altura visual real de la cabecera.
 *
 * El reporte comienza su contenido en el punto 105 y la cabecera
 * se dibuja desde el punto 28. Por ello, esta altura permite que
 * todos los elementos queden próximos a la tabla sin superponerse.
 */
const HEADER_HEIGHT = 66;

/**
 * Tamaño máximo del logo.
 */
const LOGO_MAX_WIDTH = 160;
const LOGO_MAX_HEIGHT = 53.5;

/**
 * Paleta institucional.
 */
const COLORS = {
  primary: "#4A4A4A",
  primaryDark: "#1F1F1F",
  primarySoft: "#E6E6E6",
  primarySoftBorder: "#C8C8C8",

  text: "#202020",
  muted: "#666666",

  surface: "#F5F5F5",
  border: "#D4D4D4",
  white: "#FFFFFF",
};

/**
 * Logo predeterminado.
 */
const DEFAULT_HEADER_LOGO = loadTemplateImage("img/logo.png");

export interface SalesReportHeaderData {
  /**
   * Título principal del reporte.
   */
  title: string;

  /**
   * Logo en Base64 o Data URL.
   *
   * Si no se envía, se utiliza:
   * src/reports/templates/img/logo.png
   */
  logo?: string | null;

  /**
   * Fecha y hora de generación.
   */
  generatedAt?: string | Date | null;

  /**
   * Usuario que generó el reporte.
   */
  generatedBy?: string | null;

  /**
   * Fecha inicial del reporte.
   */
  dateFrom?: string | Date | null;

  /**
   * Fecha final del reporte.
   */
  dateTo?: string | Date | null;

  /**
   * Nombre completo de la institución.
   */
  institutionName: string;

  /**
   * Nombre corto o sigla de la institución.
   */
  institutionShortName: string;

  /**
   * Ancho completo de la página en puntos.
   *
   * LETTER vertical: 612
   * LETTER horizontal: 792
   */
  pageWidth?: number;

  /**
   * Margen horizontal utilizado por el documento.
   */
  pageHorizontalMargin?: number;
}

export interface SalesHeaderPreviewData extends SalesReportHeaderData {
  description: string;
}

/**
 * Genera un documento PDF de prueba para visualizar la cabecera.
 */
export function buildSalesHeaderPreview(
  data: SalesHeaderPreviewData
): TDocumentDefinitions {
  return {
    pageSize: "LETTER" as const,

    pageMargins: [40, 36, 40, 36],

    defaultStyle: {
      font: "Helvetica",
      fontSize: 8,
      color: COLORS.text,
    },

    content: [
      buildSalesReportHeader({
        ...data,
        pageWidth: 612,
        pageHorizontalMargin: 40,
      }),

      {
        text: data.description,
        fontSize: 9,
        lineHeight: 1.25,
        color: COLORS.muted,

        margin: [0, 14, 0, 0],
      },
    ],
  };
}

/**
 * Construye la cabecera reutilizable.
 *
 * Estructura:
 *
 * ┌──────────────┬────────────────────────────┬───────────────┐
 * │ Logo         │ Institución, título y      │ Información   │
 * │ institucional│ periodo consultado         │ de generación │
 * └──────────────┴────────────────────────────┴───────────────┘
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */
export function buildSalesReportHeader(data: SalesReportHeaderData): Content {
  const generatedAt = parseDate(data.generatedAt) ?? new Date();

  const pageWidth = data.pageWidth ?? DEFAULT_PAGE_WIDTH;

  const horizontalMargin =
    data.pageHorizontalMargin ?? DEFAULT_HORIZONTAL_MARGIN;

  const availableWidth = Math.max(pageWidth - horizontalMargin * 2, 500);

  /**
   * Las columnas laterales permanecen simétricas.
   * Esto mantiene el título centrado respecto de la página.
   */
  const sideColumnWidth = Math.min(145, Math.max(115, availableWidth * 0.21));

  const centerColumnWidth = Math.max(availableWidth - sideColumnWidth * 2, 250);

  return {
    margin: [0, 0, 0, 0],

    stack: [
      {
        table: {
          widths: [sideColumnWidth, centerColumnWidth, sideColumnWidth],

          heights: () => HEADER_HEIGHT,

          dontBreakRows: true,

          body: [
            [
              buildLogoCell(data),
              buildTitleCell(data),
              buildMetaCell(data, generatedAt),
            ],
          ],
        },

        layout: mainHeaderLayout(),
      },

      buildHeaderAccentLine(availableWidth),
    ],
  } as Content;
}

/**
 * Celda izquierda: logo institucional.
 */
function buildLogoCell(data: SalesReportHeaderData): Content {
  const logo = data.logo ?? DEFAULT_HEADER_LOGO;

  return {
    border: [false, false, false, false],

    margin: [0, 0, 0, 0],

    alignment: "center",

    stack: [logo ? buildLogoImage(logo) : buildLogoPlaceholder()],
  } as Content;
}

/**
 * Logo real.
 */
function buildLogoImage(logo: string): Content {
  return {
    image: logo,

    fit: [LOGO_MAX_WIDTH, LOGO_MAX_HEIGHT],

    alignment: "center",
  } as Content;
}

/**
 * Recuadro mostrado cuando no existe un logo disponible.
 */
function buildLogoPlaceholder(): Content {
  return {
    table: {
      widths: [88],

      heights: [44],

      body: [
        [
          {
            text: "LOGO",

            fontSize: 7,

            bold: true,

            alignment: "center",

            color: COLORS.muted,

            margin: [0, 17, 0, 0],
          },
        ],
      ],
    },

    alignment: "center",

    layout: {
      hLineWidth: () => 0.6,

      vLineWidth: () => 0.6,

      hLineColor: () => COLORS.border,

      vLineColor: () => COLORS.border,

      paddingLeft: () => 0,

      paddingRight: () => 0,

      paddingTop: () => 0,

      paddingBottom: () => 0,
    },
  } as Content;
}

/**
 * Celda central:
 * institución, sigla, título y periodo consultado.
 */
function buildTitleCell(data: SalesReportHeaderData): Content {
  return {
    border: [false, false, false, false],

    margin: [10, 3, 10, 0],

    stack: [
      {
        text: truncateText(fallback(data.institutionName), 85),

        fontSize: 8,

        lineHeight: 1.05,

        bold: true,

        alignment: "center",

        color: COLORS.text,
      },

      {
        text: truncateText(fallback(data.institutionShortName), 45),

        fontSize: 7.2,

        lineHeight: 1,

        bold: true,

        alignment: "center",

        color: COLORS.primary,

        margin: [0, 1, 0, 3],
      },

      {
        text: truncateText(fallback(data.title), 95),

        fontSize: 12.5,

        lineHeight: 1.05,

        bold: true,

        alignment: "center",

        color: COLORS.primaryDark,

        margin: [0, 0, 0, 4],
      },

      buildPeriodBadge(data.dateFrom, data.dateTo),
    ],
  } as Content;
}

/**
 * Franja suave para el periodo consultado.
 */
function buildPeriodBadge(
  dateFrom: string | Date | null | undefined,

  dateTo: string | Date | null | undefined
): Content {
  return {
    table: {
      widths: ["*"],

      body: [
        [
          {
            text: [
              {
                text: "PERIODO  ",

                bold: true,

                color: COLORS.primaryDark,
              },

              {
                text: `${formatOptionalDate(dateFrom)}  —  ${formatOptionalDate(
                  dateTo
                )}`,

                color: COLORS.text,
              },
            ],

            fontSize: 7,

            alignment: "center",

            fillColor: COLORS.primarySoft,

            margin: [4, 2.5, 4, 2.5],
          },
        ],
      ],
    },

    layout: periodBadgeLayout(),
  } as Content;
}

/**
 * Celda derecha: información de generación.
 */
function buildMetaCell(
  data: SalesReportHeaderData,
  generatedAt: Date
): Content {
  return {
    border: [false, false, false, false],

    margin: [0, 15, 0, 0],

    stack: [
      {
        text: "GENERADO",

        fontSize: 7.5,

        bold: true,

        alignment: "center",

        color: COLORS.primary,

        margin: [0, 0, 0, 2],
      },

      {
        table: {
          widths: [39, "*"],

          body: [
            metaRow("Fecha", formatDate(generatedAt)),

            metaRow("Hora", formatTime(generatedAt)),

            metaRow("Usuario", truncateText(fallback(data.generatedBy), 22)),
          ],
        },

        layout: metaCardLayout(),
      },
    ],
  } as Content;
}

/**
 * Fila reutilizable para los metadatos.
 */
function metaRow(label: string, value: string): Content[] {
  return [
    {
      text: label,

      fontSize: 6.8,

      bold: true,

      alignment: "right",

      color: COLORS.primaryDark,

      fillColor: COLORS.surface,

      margin: [0, 1.2, 4, 1.2],
    } as Content,

    {
      text: value,

      fontSize: 6.8,

      alignment: "left",

      color: COLORS.text,

      fillColor: COLORS.surface,

      noWrap: true,

      margin: [0, 1.2, 2, 1.2],
    } as Content,
  ];
}

/**
 * Línea institucional inferior.
 */
function buildHeaderAccentLine(availableWidth: number): Content {
  return {
    canvas: [
      {
        type: "line",

        x1: 0,

        y1: 0,

        x2: availableWidth,

        y2: 0,

        lineWidth: 1.25,

        lineColor: COLORS.primary,
      },

      {
        type: "line",

        x1: 0,

        y1: 2,

        x2: availableWidth,

        y2: 2,

        lineWidth: 0.35,

        lineColor: COLORS.border,
      },
    ],
  } as Content;
}

/**
 * Layout principal sin bordes visibles.
 */
function mainHeaderLayout() {
  return {
    hLineWidth: () => 0,

    vLineWidth: () => 0,

    paddingLeft: () => 0,

    paddingRight: () => 0,

    paddingTop: () => 0,

    paddingBottom: () => 0,
  };
}

/**
 * Layout del periodo.
 */
function periodBadgeLayout() {
  return {
    hLineWidth: (index: number) => (index === 0 || index === 1 ? 0.45 : 0),

    vLineWidth: (index: number) => (index === 0 || index === 1 ? 0.45 : 0),

    hLineColor: () => COLORS.primarySoftBorder,

    vLineColor: () => COLORS.primarySoftBorder,

    paddingLeft: () => 0,

    paddingRight: () => 0,

    paddingTop: () => 0,

    paddingBottom: () => 0,
  };
}

/**
 * Layout del recuadro de generación.
 */
function metaCardLayout() {
  return {
    hLineWidth: (index: number) => (index === 0 || index === 3 ? 0.5 : 0.25),

    vLineWidth: (index: number) => (index === 0 || index === 2 ? 0.5 : 0),

    hLineColor: () => COLORS.border,

    vLineColor: () => COLORS.border,

    paddingLeft: () => 0,

    paddingRight: () => 0,

    paddingTop: () => 0,

    paddingBottom: () => 0,
  };
}

/**
 * Carga una imagen desde la carpeta de plantillas y la convierte
 * en una Data URL Base64 compatible con PDFMake.
 */
function loadTemplateImage(relativePath: string): string | null {
  const possiblePaths = [
    join(process.cwd(), "src", "reports", "templates", relativePath),

    join(process.cwd(), "dist", "reports", "templates", relativePath),
  ];

  const imagePath = possiblePaths.find((path) => existsSync(path));

  if (!imagePath) {
    return null;
  }

  const extension = imagePath.split(".").pop()?.toLowerCase();

  const mimeType = getImageMimeType(extension);

  const base64 = readFileSync(imagePath).toString("base64");

  return `data:${mimeType};base64,${base64}`;
}

/**
 * Obtiene el tipo MIME según la extensión.
 */
function getImageMimeType(extension: string | undefined): string {
  switch (extension) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";

    case "webp":
      return "image/webp";

    case "png":
    default:
      return "image/png";
  }
}

/**
 * Formatea una fecha opcional.
 */
function formatOptionalDate(value: string | Date | null | undefined): string {
  const date = parseDate(value);

  return date ? formatDate(date) : "-";
}

/**
 * Formato de fecha boliviano.
 */
function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("es-BO", {
    day: "2-digit",

    month: "2-digit",

    year: "numeric",
  }).format(date);
}

/**
 * Formato de hora boliviano.
 */
function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("es-BO", {
    hour: "2-digit",

    minute: "2-digit",

    second: "2-digit",

    hour12: false,
  }).format(date);
}

/**
 * Convierte diferentes formatos de fecha en Date.
 *
 * YYYY-MM-DD se trata como fecha local de referencia para evitar
 * que la zona horaria muestre el día anterior.
 */
function parseDate(value: string | Date | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const normalizedValue = value.trim();

  if (!normalizedValue) {
    return null;
  }

  const dateOnlyMatch = normalizedValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);

    const month = Number(dateOnlyMatch[2]);

    const day = Number(dateOnlyMatch[3]);

    const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(normalizedValue);

  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Devuelve un guion cuando el valor está vacío.
 */
function fallback(value: string | null | undefined): string {
  const normalized = value?.trim();

  return normalized || "-";
}

/**
 * Limita textos demasiado largos.
 */
function truncateText(value: string, maximumLength: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized.length <= maximumLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(maximumLength - 3, 0))}...`;
}
