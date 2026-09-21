import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
  UseInterceptors
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { stringify } from 'csv-stringify/sync';
import { Request, Response } from 'express';
import { AuthGuard } from 'src/auth/guards';
import { NatsService, PdfBufferService, RecordsService } from 'src/common';
import { reciboFormal, reportSales } from 'src/common/templates';

@ApiTags('sales')
@ApiBearerAuth('msp')
@UseGuards(AuthGuard)
@UseInterceptors(RecordsService)
@Controller('sales')
export class SalesController {
  constructor(
    private readonly nats: NatsService,
    private readonly pdfBuffer: PdfBufferService,
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

  @Get('groups/:groupIds')
  @ApiResponse({
    status: 200,
    description: 'Obtener los productos de diferentes grupos de ventas',
  })
  async groupsCheck(@Param('groupIds') groupIds: string) {
    return this.nats.send('sales.groupsCheck', { groupIds });
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
    return await this.nats.firstValue('sales.createSale', body);
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

    const documentDefinition = reciboFormal(dataSale.data);
    const buffer = await this.pdfBuffer.generatePdfBuffer(documentDefinition);

    res.set({
      'Content-Type': "application/pdf",
      'Content-Disposition': `inline; filename="recibo de venta"`,
      'Content-Length': buffer.length,
    });

    res.send(buffer);
  }

  @Get('reports/allSales')
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
    name: 'productIds',
    required: false,
    type: Number,
    example: 1,
  })
  @ApiQuery({
    name: 'format',
    required: false,
    enum: ['pdf', 'csv'],
    example: 'csv',
    description: 'Formato de salida. El valor predeterminado es pdf.',
  })
  @ApiResponse({
    status: 200,
    description: 'Archivo PDF o XLSX de la lista de ventas',
    schema: {
      type: 'string',
      format: 'binary',
    },
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

    const { error, message, data } =
      await this.nats.firstValue('sales.report.allSales', filters);

    if (error) {
      return res.status(500).json({ message });
    }

    const nameFile = 'reporte-ventas'

    if (format === 'csv') {
      const csv = stringify(data.reportData, { header: true });
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${nameFile}.csv"`,
      );
      return res.send(csv);
    }

    if(format === 'pdf') {
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

  @Get('forGenerateReport')
  @ApiResponse({
    status: 200,
    description: 'Obtiene los datos necesario para generar diferentes reporte',
  })
  async forGenerateReport() {
    return this.nats.send('sales.forGenerateReport', { });
  }

  @Get('cancel/:saleId')
  @ApiResponse({
    status: 200,
    description: 'Cancela una venta',
  })
  async cancelSale(@Param('saleId') saleId: string) {
    
    return this.nats.send('sales.cancelSale', { saleId });
  }

}
