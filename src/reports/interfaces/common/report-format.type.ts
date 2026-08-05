export type ReportFormat = 'pdf' | 'xlsx';

export const PDF_CONTENT_TYPE = 'application/pdf' as const;
export const XLSX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' as const;

export type ReportContentType = typeof PDF_CONTENT_TYPE | typeof XLSX_CONTENT_TYPE;
