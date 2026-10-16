import {
  Body,
  Controller,
  Get,
  Param,
  Headers,
  Post,
  UploadedFiles,
  UseInterceptors,
  UseGuards,
  Query,
  HttpException,
  Res,
} from '@nestjs/common';
import { ApiBody, ApiConsumes, ApiResponse, ApiTags } from '@nestjs/swagger';
import { firstValueFrom } from 'rxjs';
import { Response } from 'express';
import { PvtEnvs } from 'src/config';
import { HttpService } from '@nestjs/axios';
import { HashPvtGuard } from 'src/auth/guards/hashpvt.guard';
import { SaveDataKioskAuthDto } from './dto/save-data-kiosk-auth.dto';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { UploadPhotosDto } from './dto/save-photos.dto';
import { NatsService, FtpService } from 'src/common';
import { Records } from 'src/records/records.interceptor';

@ApiTags('kiosk')
@UseInterceptors(Records)
@Controller('kiosk')
export class KioskController {
  constructor(
    private readonly nats: NatsService,
    private readonly httpService: HttpService,
    private readonly ftp: FtpService,
  ) {}

  @Get('person/:identityCard')
  @ApiResponse({
    status: 200,
    description: 'Mostrar el listado de huellas digitales',
  })
  async showListFingerprint(@Param('identityCard') identityCard: string) {
    return this.nats.send('kiosk.getDataPerson', identityCard);
  }

  @Post('saveDataKioskAuth')
  @ApiBody({ type: SaveDataKioskAuthDto })
  async saveDataKioskAuth(@Body() data: SaveDataKioskAuthDto) {
    return this.nats.send('kiosk.saveDataKioskAuth', data);
  }

  @Post('savePhoto')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'photoIdentityCard', maxCount: 1 },
      { name: 'photoFace', maxCount: 1 },
    ]),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UploadPhotosDto })
  async uploadPhoto(
    @Body() body: UploadPhotosDto,
    @UploadedFiles()
    files: { photoIdentityCard?: Express.Multer.File[]; photoFace?: Express.Multer.File[] },
  ) {
    const hasCI = !!(files?.photoIdentityCard && files.photoIdentityCard.length > 0);
    const hasFace = !!(files?.photoFace && files.photoFace.length > 0);
    const photos = await this.nats.firstValue('kiosk.savePhotos', {
      personId: body.personId,
      hasCI,
      hasFace,
    });
    const filesConverted = [];

    if (hasCI) {
      filesConverted.push({
        fieldname: `file[ci]`,
        buffer: files.photoIdentityCard[0]?.buffer,
      });
    }

    if (hasFace) {
      filesConverted.push({
        fieldname: `file[face]`,
        buffer: files.photoFace[0]?.buffer,
      });
    }

    await this.ftp.uploadFile(filesConverted, photos);

    return {
      message: 'Fotos guardadas exitosamente',
      personId: body.personId,
    };
  }

  @Get('getFingerprintComparison/:id')
  @ApiResponse({
    status: 200,
    description: 'Mostrar el listado de huellas digitales de una persona',
  })
  async getFingerprintComparison(@Param('id') id: number) {
    const { data } = await this.nats.firstValue('kiosk.getFingerprintComparison', id);
    return await this.ftp.downloadFile(data, 'true');
  }

  @UseGuards(HashPvtGuard)
  @Get('person/:identityCard/ecoCom')
  @ApiResponse({
    status: 200,
    description: 'Verificar si puede crear complemento',
  })
  async VerifyEcoCom(
    @Headers('authorization') authorization: string,
    @Param('identityCard') identityCard: string,
  ) {
    const url = `${PvtEnvs.PvtBeApiServer}/kioskoComplemento?ci=${identityCard}`;
    try {
      const { data } = await firstValueFrom(
        this.httpService.get(url, { headers: { authorization } }),
      );
      return data;
    } catch (error) {
      return error.response.data;
    }
  }

  @UseGuards(HashPvtGuard)
  @Get('ecoCom/:id')
  async GetEcoComKiosko(@Headers('authorization') authorization: string, @Param('id') id: string) {
    const url = `${PvtEnvs.PvtBeApiServer}/eco_com/${id}`;
    try {
      const { data } = await firstValueFrom(
        this.httpService.get(url, { headers: { authorization } }),
      );
      return data;
    } catch (error) {
      return error.response.data;
    }
  }

  @UseGuards(HashPvtGuard)
  @Post('ecoCom')
  async CreateEcoComKiosko(@Headers('authorization') authorization: string, @Body() body) {
    const url = `${PvtEnvs.PvtBeApiServer}/eco_com`;
    try {
      const { data } = await firstValueFrom(
        this.httpService.post(url, body, { headers: { authorization } }),
      );
      return data;
    } catch (error) {
      return error.response.data;
    }
  }

  @Get('procedures/:identityCard')
  @ApiResponse({
    status: 200,
    description: 'Obtener préstamos de un afiliado',
  })
  async getAffiliateLoans(@Param('identityCard') identityCard: string) {
    let ecoComResponse: any = null;
    let loansResponse: any = null;
    const ecoComUrl = `${PvtEnvs.PvtBeApiServer}/kioskoComplemento?ci=${identityCard}`;
    const loansUrl = `${PvtEnvs.PvtBackendApiServer}/kiosk/verify_loans/${identityCard}`;
    try {
      const { data } = await firstValueFrom(this.httpService.get(ecoComUrl));
      ecoComResponse = data;
    } catch (error) {
      ecoComResponse = {
        error: error.response?.data?.error,
        canCreate: error.response?.data?.canCreate,
        message: error.response?.data?.message || 'Error al verificar complemento',
      };
    }

    try {
      const { data } = await firstValueFrom(this.httpService.get(loansUrl));
      loansResponse = data;
    } catch (error) {
      loansResponse = {
        error: true,
        message: error.response?.data?.message || 'Error al obtener préstamos',
      };
    }

    // El kiosko no maneja token: el afiliado se resuelve por ci. Se usa solo para
    // decidir si el ítem aparece en el menú, así que un fallo devuelve lista vacía.
    const retFunResponse = await this.probeKioskList(
      'kiosk.retFunRetirementFunds',
      identityCard,
      'Error al obtener fondo de retiro',
    );

    const quotaAidResponse = await this.probeKioskList(
      'kiosk.quotaAidMortuaries',
      identityCard,
      'Error al obtener cuota y auxilio mortuorio',
    );

    const hasRetFun = Array.isArray(retFunResponse?.data) && retFunResponse.data.length > 0;
    const hasQuotaAid = Array.isArray(quotaAidResponse?.data) && quotaAidResponse.data.length > 0;

    return {
      ecoCom: {
        canShow: !ecoComResponse.error,
        canCreate: ecoComResponse.canCreate,
        message: ecoComResponse.message,
      },
      loans: { canShow: loansResponse.hasLoan },
      contributions: { canShow: true },
      retirementFundQuotaAid: { canShow: hasRetFun || hasQuotaAid },
    };
  }

  // --- Fondo de retiro y cuota/auxilio mortuorio para el kiosko (afiliado por ci) ---
  // Cada endpoint encadena: Gateway -> NATS (Kiosk-Service) -> NATS (pvtBe) -> API de PVT-BE.
  @UseGuards(HashPvtGuard)
  @Get('ret_fun')
  @ApiResponse({
    status: 200,
    description: 'Obtener trámites de fondo de retiro de un afiliado por CI',
  })
  async GetRetFunList(
    @Headers('authorization') authorization: string,
    @Query('ci') ci: string,
  ) {
    return this.callRetFunQuotaAid(
      'kiosk.retFunRetirementFunds',
      { authorization, ci },
      'Error al obtener fondo de retiro',
    );
  }

  @UseGuards(HashPvtGuard)
  @Get('quotaAid')
  @ApiResponse({
    status: 200,
    description: 'Obtener trámites de cuota y auxilio mortuorio de un afiliado por CI',
  })
  async GetQuotaAidList(
    @Headers('authorization') authorization: string,
    @Query('ci') ci: string,
  ) {
    return this.callRetFunQuotaAid(
      'kiosk.quotaAidMortuaries',
      { authorization, ci },
      'Error al obtener cuota y auxilio mortuorio',
    );
  }

  // El microservicio devuelve el PDF en base64 (`binaryPdf`); aquí se decodifica y se responde el binario.
  @UseGuards(HashPvtGuard)
  @Get('ret_fun/:retirementFundId/print/liquidation')
  @ApiResponse({
    status: 200,
    description: 'Obtener la liquidación de pago de un trámite de fondo de retiro',
  })
  async PrintRetFunLiquidation(
    @Headers('authorization') authorization: string,
    @Param('retirementFundId') retirementFundId: string,
    @Res() res: Response,
  ) {
    const response = await this.callRetFunQuotaAid(
      'kiosk.retFunLiquidationPrint',
      { authorization, retirementFundId },
      'Error al obtener la liquidación',
    );
    if (!response?.binaryPdf) {
      throw new HttpException('Error al obtener la liquidación', 500);
    }
    const pdfBuffer = Buffer.from(response.binaryPdf, 'base64');
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="ret_fun_${retirementFundId}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });
    res.send(pdfBuffer);
    return;
  }

  @UseGuards(HashPvtGuard)
  @Get('quotaAid/:quotaAidId/print/liquidation')
  @ApiResponse({
    status: 200,
    description: 'Obtener la liquidación de pago de un trámite de cuota y auxilio mortuorio',
  })
  async PrintQuotaAidLiquidation(
    @Headers('authorization') authorization: string,
    @Param('quotaAidId') quotaAidId: string,
    @Res() res: Response,
  ) {
    const response = await this.callRetFunQuotaAid(
      'kiosk.quotaAidLiquidationPrint',
      { authorization, quotaAidId },
      'Error al obtener la liquidación',
    );
    if (!response?.binaryPdf) {
      throw new HttpException('Error al obtener la liquidación', 500);
    }
    const pdfBuffer = Buffer.from(response.binaryPdf, 'base64');
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="quota_aid_${quotaAidId}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });
    res.send(pdfBuffer);
    return;
  }

  // Ejecuta un patrón del Kiosk-Service y traduce sus errores a HttpException.
  // El Kiosk-Service responde { error, message, data } (o lanza RpcException).
  private async callRetFunQuotaAid(
    pattern: string,
    payload: Record<string, any>,
    fallbackMessage: string,
  ) {
    let response: any;
    try {
      response = await this.nats.firstValue(pattern, payload);
    } catch (error: any) {
      const status =
        typeof error?.getStatus === 'function' ? error.getStatus() : 502;
      const body =
        typeof error?.getResponse === 'function' ? error.getResponse() : null;
      const message =
        (typeof body === 'string' ? body : body?.message) ?? fallbackMessage;
      throw new HttpException(message, Number.isInteger(status) ? status : 502);
    }
    if (response?.error || response?.serviceStatus === false) {
      throw new HttpException(
        response?.message ?? fallbackMessage,
        Number.isInteger(response?.statusCode) ? response.statusCode : 502,
      );
    }
    return response;
  }

  // Sondeo para el menú: usa el HASH del kiosko como autorización y, ante error,
  // devuelve una lista vacía en vez de romper el listado.
  private async probeKioskList(
    pattern: string,
    ci: string,
    fallbackMessage: string,
  ) {
    try {
      return await this.nats.firstValue(pattern, {
        authorization: `Bearer ${PvtEnvs.PvtHashSecret}`,
        ci,
      });
    } catch (error: any) {
      const body =
        typeof error?.getResponse === 'function' ? error.getResponse() : null;
      const message =
        (typeof body === 'string' ? body : body?.message) ?? fallbackMessage;
      return { error: true, message, data: [] };
    }
  }
}
