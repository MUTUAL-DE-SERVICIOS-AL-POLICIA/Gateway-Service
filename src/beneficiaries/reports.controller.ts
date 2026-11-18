import {
  Controller,
  Get,
  Query,
  Req,
  Res,
  UseGuards,
  UseInterceptors
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { stringify } from 'csv-stringify/sync';
import { Request, Response } from 'express';
import { AuthGuard } from 'src/auth/guards/auth.guard';
import { NatsService, RecordsService } from 'src/common';

@ApiBearerAuth('msp')
@ApiTags('beneficiaries')
@UseGuards(AuthGuard)
@UseInterceptors(RecordsService)
@Controller('beneficiaries/reports')
export class ReportsController {
  constructor(
    private readonly nats: NatsService,
  ) {}

  @Get('registerFingerprints')
  @ApiOperation({ summary: 'Generar lista de  huellas digitales' })
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
    name: 'allRecords',
    required: false,
    example: true,
  })
  async registerFingerprints(
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Query('allRecords') allRecords: boolean,
    @Req() req: Request & { user?: { username?: string; name?: string } },
    @Res() res: Response,
  ) {
    const filters = {
      dateFrom,
      dateTo,
      allRecords,
      user: req.user?.username,
    };

    const { error, message, data } =
      await this.nats.firstValue('beneficiary.report.registerFingerprints', filters);

    if (error) {
      return res.status(500).json({ message });
    }

    const nameFile = 'reporte-de-huellas-digitales-registradas';

    const csv = stringify(data.reportData, { header: true });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${nameFile}.csv"`,
    );
    return res.send(csv);
  }

  @Get('registerPhotos')
  @ApiOperation({ summary: 'Generar lista de fotos' })
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
    name: 'allRecords',
    required: false,
    example: true,
  })

  async registerPhotos(
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Query('allRecords') allRecords: boolean,
    @Req() req: Request & { user?: { username?: string; name?: string } },
    @Res() res: Response,
  ) {
    const filters = {
      dateFrom,
      dateTo,
      allRecords,
      user: req.user?.username,
    };

    const { error, message, data } =
      await this.nats.firstValue('beneficiary.report.registerPhotos', filters);

    if (error) {
      return res.status(500).json({ message });
    }

    const nameFile = 'reporte-de-fotos-registradas';

    const csv = stringify(data.reportData, { header: true });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${nameFile}.csv"`,
    );
    return res.send(csv);
  }
}
