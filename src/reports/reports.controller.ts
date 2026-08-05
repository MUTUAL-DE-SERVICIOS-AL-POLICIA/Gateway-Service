import { Controller, Get, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { ReportsSalesService } from './services/reports.sales.service';

@ApiTags('reports')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsSalesService: ReportsSalesService) {}

  @Get('headers/preview')
  @ApiOperation({ summary: 'Vista previa de cabecera reutilizable de ventas' })
  @ApiResponse({ status: 200, description: 'PDF de vista previa de cabecera' })
  async salesHeaderPreview(@Res() res: Response) {
    const preview = await this.reportsSalesService.generateSalesHeaderPreview();

    res.set({
      'Content-Type': preview.contentType,
      'Content-Disposition': `${preview.disposition}; filename="${preview.fileName}"`,
      'Content-Length': preview.buffer.length,
    });

    res.send(preview.buffer);
  }
  
}
