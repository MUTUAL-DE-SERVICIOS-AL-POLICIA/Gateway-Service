/// <reference types="jest" />
import { CollectionsReportsController } from './reports.controller';
import { reportSales } from 'src/common/templates';

jest.mock('src/common/templates', () => ({ reportSales: jest.fn(() => ({ content: [] })) }));

describe('CollectionsReportsController', () => {
  const nats = { firstValue: jest.fn() };
  const pdfBuffer = { generatePdfBuffer: jest.fn() };
  const response = () => {
    const res: any = {
      setHeader: jest.fn(),
      set: jest.fn(),
      send: jest.fn(),
      json: jest.fn(),
      status: jest.fn(),
    };
    res.status.mockReturnValue(res);
    return res;
  };
  const controller = new CollectionsReportsController(nats as any, pdfBuffer as any);

  beforeEach(() => jest.clearAllMocks());

  it('reuses sales.report.allSales and returns CSV with the same filters', async () => {
    nats.firstValue.mockResolvedValue({
      error: false,
      message: 'ok',
      data: { reportData: [{ total: 10 }] },
    });
    const res = response();

    await controller.reportAllSales(
      '2026-07-01',
      '2026-07-13',
      '1,2',
      'csv',
      { user: { username: 'operator' } } as any,
      res,
    );

    expect(nats.firstValue).toHaveBeenCalledTimes(1);
    expect(nats.firstValue).toHaveBeenCalledWith('sales.report.allSales', {
      dateFrom: '2026-07-01',
      dateTo: '2026-07-13',
      productIds: '1,2',
      user: 'operator',
    });
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
    expect(res.send).toHaveBeenCalledTimes(1);
  });

  it('uses the existing sales template and PDF generator for PDF', async () => {
    const data = { reportData: [] };
    nats.firstValue.mockResolvedValue({ error: false, message: 'ok', data });
    pdfBuffer.generatePdfBuffer.mockResolvedValue(Buffer.from('pdf'));
    const res = response();

    await controller.reportAllSales(
      '2026-07-01',
      '2026-07-13',
      '',
      'pdf',
      { user: { username: 'operator' } } as any,
      res,
    );

    expect(reportSales).toHaveBeenCalledWith(data);
    expect(pdfBuffer.generatePdfBuffer).toHaveBeenCalledTimes(1);
    expect(res.set).toHaveBeenCalledWith(
      expect.objectContaining({ 'Content-Type': 'application/pdf' }),
    );
    expect(res.send).toHaveBeenCalledWith(Buffer.from('pdf'));
  });
});
