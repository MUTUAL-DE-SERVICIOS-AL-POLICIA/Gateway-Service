import { HttpService } from '@nestjs/axios';
import {
    Body,
    Controller,
    Get,
    Headers,
    Param,
    Post,
    UploadedFiles,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiResponse, ApiTags } from '@nestjs/swagger';
import { firstValueFrom } from 'rxjs';
import { HashPvtGuard } from 'src/auth/guards/hashpvt.guard';
import { FtpService, NatsService } from 'src/common';
import { Records } from 'src/common/services/records.service';
import { PvtEnvs } from 'src/config';
import { SaveDataKioskAuthDto } from './dto/save-data-kiosk-auth.dto';
import { UploadPhotosDto } from './dto/save-photos.dto';

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
    } catch {
      return ;
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
    } catch {
      return {
        error: true,
        message: 'Error al obtener complemento',
      };
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
    } catch {
      return {
        error: true,
        message: 'Error al crear complemento',
      };
    }
  }

  @Get('procedures/:identityCard')
  @ApiResponse({
    status: 200,
    description: 'Obtener préstamos de un afiliado',
  })
  async getAffiliateLoans(@Param('identityCard') identityCard: string) {
    const ecoComUrl = `${PvtEnvs.PvtBeApiServer}/kioskoComplemento?ci=${identityCard}`;
    const loansUrl = `${PvtEnvs.PvtBackendApiServer}/kiosk/verify_loans/${identityCard}`;

    let ecoComResponse: any;
    let loansResponse: any;

    try {
      const { data } = await firstValueFrom(
        this.httpService.get(ecoComUrl),
      );

      ecoComResponse = data;
    } catch (error) {
      ecoComResponse = {
        error: true,
        message: error || 'Error al obtener complemento',
      };
    }

    try {
      const { data } = await firstValueFrom(
        this.httpService.get(loansUrl),
      );

      loansResponse = data;
    } catch (error) {
      loansResponse = {
        error: true,
        message: error || 'Error al obtener préstamos',
      };
    }

    return {
      ecoCom: {
        canShow: !ecoComResponse.error,
        canCreate: ecoComResponse.canCreate,
        message: ecoComResponse.message,
      },
      loans: {
        canShow: loansResponse.hasLoan,
      },
      contributions: {
        canShow: true,
      },
    };
  }
}
