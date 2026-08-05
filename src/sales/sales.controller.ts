import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  Req,
  Res,
  UseGuards,
  Post,
  ParseUUIDPipe,
  Body
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiQuery,
  ApiResponse,
  ApiTags,
  ApiBody,
} from '@nestjs/swagger';
import { Request, Response } from 'express';
import { NatsService } from 'src/common';
import {
  PDF_CONTENT_TYPE,
  ReportFormat,
  XLSX_CONTENT_TYPE,
} from 'src/reports/interfaces/common/report-format.type';
import { ReportsSalesService } from 'src/reports/services/reports.sales.service';
import { AuthGuard } from 'src/auth/guards';

@ApiTags('sales')
@ApiBearerAuth('msp')
@UseGuards(AuthGuard)
@Controller('sales')
export class SalesController {
  constructor(
    private readonly nats: NatsService,
    private readonly reportsSalesService: ReportsSalesService,
  ) { }

  @Get('search/:value/:type')
  @ApiResponse({
    status: 200,
    description: 'Buscar un afiliado',
  })
  async searchPerson(@Param('value') value: string, @Param('type') type: string) {
    return this.nats.send('sales.searchPerson', { value, type });
  }

  @Get('groups/:groupId/products')
  @ApiResponse({
    status: 200,
    description: 'Obtener los productos de un grupo de ventas',
  })
  async groupProducts(@Param('groupId') groupId: number) {
    return this.nats.send('sales.groupProducts', { groupId });
  }

  @Get(':personUuid/forCreatingSale')
  @ApiResponse({
    status: 200,
    description: 'Muestra una persona con sus relaciones y características adicionales',
  })
  async findPerson(@Param('personUuid', new ParseUUIDPipe()) personUuid: string) {
    return this.nats.send('sales.forCreatingSale', { personUuid });
  }

  @Post('generateQr')
  @ApiOperation({
    summary: 'Crear Qr en base a la Venta',
    description: `Este endpoint crea el Qr para las ventas`,
  })
  @ApiResponse({
    status: 200,
    description: 'El Qr fue creado exitosamente',
  })
  @ApiBody({
    schema: {
      example: {
        personId: 1,
        parameterId: 1,
        paymentTypeId: 1,
        saleProducts: [
          {
            id: 5,
            name: 'Folder Préstamos Sector Activo',
            code: 'F-PA',
            price: '25.00',
            amount: 1,
          },
        ],
      },
    },
  })
  async generateQr(@Body() body: any) {
    return await this.nats.firstValue('sales.generateQr', body);
  }

  @Post('createSale')
  @ApiOperation({
    summary: 'Crear Venta',
    description: `Este endpoint crea ventas, los productos de la venta y el voucher`,
  })
  @ApiResponse({
    status: 200,
    description: 'La venta fue creado exitosamente',
  })
  @ApiBody({
    schema: {
      example: {
        personId: 1,
        parameterId: 1,
        paymentTypeId: 1,
        saleProducts: [
          {
            id: 5,
            name: 'Folder Préstamos Sector Activo',
            code: 'F-PA',
            price: '25.00',
            amount: 1,
          },
        ],
      },
    },
  })
  async createSale(@Body() body: any) {
    const response = await this.nats.firstValue('sales.createSale', body);
    return response;
  }

  @Get(':personId/sales')
  @ApiOperation({
    summary: 'Obtener ventas de una persona',
    description: `Este endpoint obtiene las ventas de una persona`,
  })
  @ApiResponse({
    status: 200,
    description: 'Las ventas fueron obtenidas exitosamente',
  })
  @ApiParam({
    name: 'personId',
    description: 'ID de la persona',
    type: Number,
  })
  async personSales(@Param('personId', new ParseIntPipe()) personId: number) {
    return await this.nats.firstValue('sales.personSales', { personId });
  }

  @Get(':personId/qrPending')
  @ApiOperation({
    summary: 'Obtener Qr pendientes de una persona',
    description: `Este endpoint obtiene los Qr pendientes de una persona`,
  })
  @ApiResponse({
    status: 200,
    description: 'Los Qr fueron obtenidos exitosamente',
  })
  @ApiParam({
    name: 'personId',
    description: 'ID de la persona',
    type: Number,
  })
  async personPendingQr(@Param('personId', new ParseIntPipe()) personId: number) {
    return await this.nats.firstValue('sales.personPendingQr', { personId });
  }



  @Get('voucherPdf/:saleId')
  @ApiOperation({ summary: 'Generar recibo oficial de venta en PDF' })
  @ApiParam({ name: 'saleId', type: Number, example: 1 })
  @ApiProduces('application/pdf')
  @ApiResponse({
    status: 200,
    description: 'PDF del recibo oficial',
    schema: {
      type: 'string',
      format: 'binary',
    },
  })
  async voucherPdf(
    @Param('saleId', ParseIntPipe) saleId: number,
    @Res() res: Response,
  ) {
    const dataSale = await this.nats.firstValue('sales.voucherPdf', {
      saleId,
    });

    const receipt = await this.reportsSalesService.generateSalesReceiptPdf(dataSale.data);

    res.set({
      'Content-Type': receipt.contentType,
      'Content-Disposition': `${receipt.disposition}; filename="${receipt.fileName}"`,
      'Content-Length': receipt.buffer.length,
    });

    res.send(receipt.buffer);
  }

  @Get('reports/sales-list')
  @ApiOperation({ summary: 'Generar lista de ventas en PDF o Excel' })
  @ApiQuery({
    name: 'dateFrom',
    required: true,
    example: '2026-07-01',
  })
  @ApiQuery({
    name: 'dateTo',
    required: true,
    example: '2026-07-13',
  })
  @ApiQuery({
    name: 'format',
    required: false,
    enum: ['pdf', 'xlsx'],
    example: 'xlsx',
    description: 'Formato de salida. El valor predeterminado es pdf.',
  })
  @ApiProduces(PDF_CONTENT_TYPE, XLSX_CONTENT_TYPE)
  @ApiResponse({
    status: 200,
    description: 'Archivo PDF o XLSX de la lista de ventas',
    schema: {
      type: 'string',
      format: 'binary',
    },
  })
  async salesList(
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Query('format') format: string | undefined,
    @Req() req: Request & { user?: { username?: string; name?: string } },
    @Res() res: Response,
  ) {
    if (!dateFrom || !dateTo) {
      throw new BadRequestException({
        error: true,
        message: 'Debe enviar dateFrom y dateTo para generar el reporte.',
      });
    }
    const normalizedFormat = String(format ?? 'pdf')
      .trim()
      .toLowerCase();
    if (!['pdf', 'xlsx'].includes(normalizedFormat)) {
      throw new BadRequestException({
        error: true,
        message: 'El formato debe ser pdf o xlsx.',
      });
    }
    const dataSale = await this.nats.firstValue('sales.list', {
      dateFrom,
      dateTo,
    });
    const reportData = {
      ...dataSale.data,
      metadata: {
        ...dataSale.data.metadata,
        generatedBy: req.user?.username ?? req.user?.name,
      },
    };
    const report =
      (normalizedFormat as ReportFormat) === 'xlsx'
        ? await this.reportsSalesService.generateSalesListXlsx(reportData)
        : await this.reportsSalesService.generateSalesListPdf(reportData);
    res.set({
      'Content-Type': report.contentType,
      'Content-Disposition': `${report.disposition}; filename="${report.fileName}"`,
      'Content-Length': report.buffer.length,
    });
    res.send(report.buffer);
  }

  @Get(':qrId/qrImage')
  @ApiResponse({
    status: 200,
    description: 'Obtener la imagen del qr',
  })
  async getQrImage(@Param('qrId') qrId: string) {
    const response = await this.nats.firstValue('sales.qrImage', { qrId });
    return {
      error: false,
      message: 'Qr image obtenido',
      data: {
        qrImage: response,
      },
    }
  }

  @Get('records/:personId')
  @ApiResponse({
    status: 200,
    description: 'Obtener los registros de una persona por su ID',
  })
  async personRecords(@Param('personId', ParseIntPipe) personId: number) {
    return this.nats.firstValue('sales.personSalesRecords', { personId });
  }
}
