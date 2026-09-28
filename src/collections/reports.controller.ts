import { Controller, Get, Query, Req, Res, UseInterceptors } from '@nestjs/common';
import { ApiOperation, ApiProduces, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { stringify } from 'csv-stringify/sync';
import { Request, Response } from 'express';
import { WebController, WebSessionOnly } from 'src/auth/decorators/web-authorization.decorators';
import { NatsService, PdfBufferService, RecordsService } from 'src/common';
import { reportSales } from 'src/common/templates';

@ApiTags('collections')
@WebController('collections', 'reports')
@UseInterceptors(RecordsService)
@Controller('collections/reports')
export class CollectionsReportsController {
  constructor(
    private readonly nats: NatsService,
    private readonly pdfBuffer: PdfBufferService,
  ) {}

  @Get('allSales')
  @WebSessionOnly()
  @ApiOperation({ summary: 'Generar lista de ventas en PDF o CSV para recaudaciones' })
  @ApiQuery({ name: 'dateFrom', required: true, example: '2026-07-01' })
  @ApiQuery({ name: 'dateTo', required: true, example: '2026-07-13' })
  @ApiQuery({ name: 'productIds', required: false, type: String, example: '1,2' })
  @ApiQuery({ name: 'format', required: false, enum: ['pdf', 'csv'], example: 'csv' })
  @ApiProduces('application/pdf', 'text/csv')
  @ApiResponse({
    status: 200,
    description: 'Archivo PDF o CSV de la lista de ventas',
    schema: { type: 'string', format: 'binary' },
  })
  async reportAllSales(
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Query('productIds') productIds: string,
    @Query('format') format: string,
    @Req() req: Request & { user?: { username?: string; name?: string } },
    @Res() res: Response,
  ) {
    const filters = {
      dateFrom,
      dateTo,
      productIds,
      user: req.user?.username,
    };
    const { error, message, data } = await this.nats.firstValue('sales.report.allSales', filters);

    if (error) return res.status(500).json({ message });

    const nameFile = 'reporte-ventas';
    if (format === 'csv') {
      const csv = stringify(data.reportData, { header: true });
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${nameFile}.csv"`);
      return res.send(csv);
    }

    const documentDefinition = await reportSales(data);
    const buffer = await this.pdfBuffer.generatePdfBuffer(documentDefinition);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${nameFile}.pdf"`,
      'Content-Length': buffer.length,
    });
    return res.send(buffer);
  }
}
