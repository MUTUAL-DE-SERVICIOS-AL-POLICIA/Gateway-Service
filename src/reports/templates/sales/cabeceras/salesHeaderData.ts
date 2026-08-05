import { SalesListData } from '../../../interfaces/sales/sales-list-data.interface';
import type { SalesReportHeaderData } from './headerPdfTemplate';

export function buildSalesListHeaderData(data: SalesListData): SalesReportHeaderData {
  return {
    institutionName: 'MUTUAL DE SERVICIOS AL POLICIA',
    institutionShortName: '"MUSERPOL"',
    title: 'REPORTE DE VENTAS',
    generatedAt: data.metadata?.generatedAt ?? new Date(),
    generatedBy: data.metadata?.generatedBy,
    dateFrom: data.filters.dateFrom,
    dateTo: data.filters.dateTo,
  };
}
