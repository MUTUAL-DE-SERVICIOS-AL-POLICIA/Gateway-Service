/// <reference types="jest" />
import { ReportsController } from './reports.controller';

jest.mock('src/config', () => ({ NATS_SERVICE: 'NATS_SERVICE' }));
jest.mock('src/common', () => ({
  NatsService: class NatsService {},
  RecordsService: class RecordsService {},
}));

describe('ReportsController', () => {
  it('preserves the beneficiary report NATS and CSV download contract', async () => {
    const nats = {
      firstValue: jest.fn().mockResolvedValue({
        error: false,
        message: 'Reporte generado',
        data: { reportData: [{ NUP: 123, Nombre: 'Persona' }] },
      }),
    };
    const response = {
      setHeader: jest.fn(),
      send: jest.fn((body: unknown) => body),
      status: jest.fn(),
      json: jest.fn(),
    };
    const controller = new ReportsController(nats as never);

    await controller.reportAllSales(
      '2026-07-01',
      '2026-07-13',
      { user: { username: 'operador' } } as never,
      response as never,
    );

    expect(nats.firstValue).toHaveBeenCalledWith('beneficiary.report.registerFingerprints', {
      dateFrom: '2026-07-01',
      dateTo: '2026-07-13',
      user: 'operador',
    });
    expect(response.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
    expect(response.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      'attachment; filename="reporte-de-huellas-digitales-registradas.csv"',
    );
    expect(response.send).toHaveBeenCalledWith('NUP,Nombre\n123,Persona\n');
  });
});
