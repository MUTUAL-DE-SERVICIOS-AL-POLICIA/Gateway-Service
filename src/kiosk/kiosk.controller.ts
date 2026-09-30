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
      return error;
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
      return error;
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
      return error;
    }
  }

  @Get('procedures/:identityCard')
  @ApiResponse({
    status: 200,
    description: 'Obtener préstamos de un afiliado',
  })
  async getAffiliateLoans(@Param('identityCard') identityCard: string) {
    let ecoComResponse: any;
    let loansResponse: any;
    let retFunResponse: any;
    let quotaAidResponse: any;
    const ecoComUrl = `${PvtEnvs.PvtBeApiServer}/kioskoComplemento?ci=${identityCard}`;
    const loansUrl = `${PvtEnvs.PvtBackendApiServer}/kiosk/verify_loans/${identityCard}`;
    const retFunUrl = `${PvtEnvs.PvtBeApiServer}/kiosko/ret_fun?ci=${identityCard}`;
    const quotaAidUrl = `${PvtEnvs.PvtBeApiServer}/kiosko/quota_aid?ci=${identityCard}`;
    const pvtAuth = `Bearer ${PvtEnvs.PvtHashSecret}`;
    try {
      const { data } = await firstValueFrom(this.httpService.get(ecoComUrl));
      ecoComResponse = data;
    } catch (error) {
      ecoComResponse = {
        error: true,
        message: error || 'Error al obtener complemento',
      };
      
    }

    try {
      const { data } = await firstValueFrom(this.httpService.get(loansUrl));
      loansResponse = data;
    } catch (error) {
      loansResponse = {
        error: true,
        message: error || 'Error al obtener préstamos',
      };
    }

    try {
      const { data } = await firstValueFrom(
        this.httpService.get(retFunUrl, { headers: { authorization: pvtAuth } }),
      );
      retFunResponse = data;
    } catch (error) {
      retFunResponse = {
        error: true,
        data: [],
        message: error || 'Error al obtener fondo de retiro',
      };
    }

    try {
      const { data } = await firstValueFrom(
        this.httpService.get(quotaAidUrl, { headers: { authorization: pvtAuth } }),
      );
      quotaAidResponse = data;
    } catch (error) {
      quotaAidResponse = {
        error: true,
        data: [],
        message: error || 'Error al obtener cuota y auxilio mortuorio',
      };
    }

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
      retirementBenefits: { canShow: hasRetFun || hasQuotaAid },
    };
  }

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
    const url = `${PvtEnvs.PvtBeApiServer}/kiosko/ret_fun?ci=${ci}`;
    try {
      const { data } = await firstValueFrom(
        this.httpService.get(url, { headers: { authorization } }),
      );
      return data;
    } catch (error: any) {
      throw new HttpException(
        error?.response?.data?.message ?? 'Error al obtener fondo de retiro',
        error?.response?.status ?? 500,
      );
    }
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
    const url = `${PvtEnvs.PvtBeApiServer}/kiosko/quota_aid?ci=${ci}`;
    try {
      const { data } = await firstValueFrom(
        this.httpService.get(url, { headers: { authorization } }),
      );
      return data;
    } catch (error: any) {
      throw new HttpException(
        error?.response?.data?.message ?? 'Error al obtener cuota y auxilio mortuorio',
        error?.response?.status ?? 500,
      );
    }
  }

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
    const url = `${PvtEnvs.PvtBeApiServer}/kiosko/ret_fun/${retirementFundId}/print/liquidation`;
    try {
      const { data } = await firstValueFrom(
        this.httpService.get(url, {
          headers: { authorization },
          responseType: 'arraybuffer',
        }),
      );
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="ret_fun_${retirementFundId}.pdf"`,
        'Content-Length': data.length,
      });
      res.send(data);
      return;
    } catch (error: any) {
      throw new HttpException(
        error?.response?.data?.message ?? 'Error al obtener la liquidación',
        error?.response?.status ?? 500,
      );
    }
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
    const url = `${PvtEnvs.PvtBeApiServer}/kiosko/quota_aid/${quotaAidId}/print/liquidation`;
    try {
      const { data } = await firstValueFrom(
        this.httpService.get(url, {
          headers: { authorization },
          responseType: 'arraybuffer',
        }),
      );
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="quota_aid_${quotaAidId}.pdf"`,
        'Content-Length': data.length,
      });
      res.send(data);
      return;
    } catch (error: any) {
      throw new HttpException(
        error?.response?.data?.message ?? 'Error al obtener la liquidación',
        error?.response?.status ?? 500,
      );
    }
  }
}
