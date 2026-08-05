import { Workbook } from 'exceljs';
import { SalesListData } from '../../../interfaces/sales/sales-list-data.interface';

const HEADERS = [
  'CÓDIGO',
  'FECHA - HORA',
  'TITULAR',
  'SERVICIO',
  'CANT.',
  'PRECIO',
  'TIPO PAGO',
  'TOTAL',
  'RECEPCIONISTA',
];

export function reportSalesExcel(data: SalesListData): Workbook {
  const workbook = new Workbook();

  workbook.creator = data.metadata?.generatedBy || 'Gateway-Service';
  const worksheet = workbook.addWorksheet('Ventas');

  worksheet.addRow(HEADERS);

  data.sales.forEach((sale) => {
    worksheet.addRow([
      sale.code ?? '',
      sale.receptionDate ?? '',
      sale.principalCustomer ?? '',
      sale.service ?? '',
      sale.amount ?? '',
      sale.price ?? '',
      sale.paymentType ?? '',
      sale.total ?? '',
      sale.receptionist ?? '',
    ]);
  });

  return workbook;
}
