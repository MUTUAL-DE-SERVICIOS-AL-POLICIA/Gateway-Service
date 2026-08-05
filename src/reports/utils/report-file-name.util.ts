import { ReportFormat } from '../interfaces/common/report-format.type';

export const buildReceiptFileName = (code: string | null | undefined): string => {
  const normalizedCode = String(code || 'sin-codigo').replace(/[^a-zA-Z0-9-_]/g, '');

  return `recibo-${normalizedCode}.pdf`;
};

export const buildSalesListFileName = (
  dateFrom: string | null | undefined,
  dateTo: string | null | undefined,
  format: ReportFormat = 'pdf',
): string => {
  const from = normalizeDateForFileName(dateFrom) ?? 'sin-fecha-inicio';
  const to = normalizeDateForFileName(dateTo) ?? 'sin-fecha-fin';

  return `reporte-ventas-${from}-${to}.${format}`;
};

function normalizeDateForFileName(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalizedValue = String(value).trim();
  const datePrefix = normalizedValue.match(/^(\d{4}-\d{2}-\d{2})/)?.[1];

  if (datePrefix) {
    return datePrefix;
  }

  const date = new Date(normalizedValue);

  if (Number.isNaN(date.getTime())) {
    return normalizedValue.replace(/[^a-zA-Z0-9-_]/g, '');
  }

  return date.toISOString().slice(0, 10);
}
