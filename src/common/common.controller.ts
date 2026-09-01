import {
  Controller,
  Get,
  Param,
  Post,
  Put,
  UploadedFile,
  UseInterceptors,
  Body,
  UseGuards,
} from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ApiBody, ApiConsumes, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  WhatsappService,
  SmsService,
  FtpService,
  CitizenshipDigitalService,
  BcbService,
  SmsDto,
  WhatsappDto,
} from 'src/common';
import { AuthGuard } from 'src/auth/guards';

@ApiTags('common')
@Controller('common')
export class CommonController {
  constructor(
    private readonly ftp: FtpService,
    private readonly sms: SmsService,
    private readonly whatsapp: WhatsappService,
    private readonly citizenshipDigital: CitizenshipDigitalService,
    private readonly bcbService: BcbService,
  ) {}

  @MessagePattern('ftp.listFiles')
  async listFiles(data: { path: string; key?: boolean }) {
    return this.ftp.listFiles(data.path, data.key);
  }

  @MessagePattern('ftp.renameFile')
  async renameFile(data: { oldPath: string; newPath: string }) {
    return this.ftp.renameFile(data.oldPath, data.newPath);
  }

  @MessagePattern('ftp.connectSwitch')
  async connectSwitch(data: { value: string }) {
    return this.ftp.connectSwitch(data.value);
  }

  @Post('uploadChunk')
  @ApiOperation({ summary: 'Subir por chunks' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Chunk del archivo (máx. 5MB)',
    type: 'multipart/form-data',
    required: true,
    schema: {
      type: 'object',
      properties: {
        chunk: {
          type: 'string',
          format: 'binary',
          description: 'Chunk del archivo',
        },
        openFtp: { type: 'string' },
        closeFtp: { type: 'string' },
        numberChunk: { type: 'string' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('chunk'))
  @UseGuards(AuthGuard)
  async uploadChunk(@UploadedFile() chunk: Express.Multer.File, @Body() body: any) {
    const { nameChunk } = body;
    await this.ftp.uploadChunk(chunk, nameChunk);

    return {
      message: 'Chunk subido exitosamente',
      serviceStatus: true,
    };
  }

  @MessagePattern('ftp.saveDataTmp')
  async saveDataTmp(data: { path: string; name: string; data: any; ttlMs?: number }) {
    return await this.ftp.saveDataTmp(data.path, data.name, data.data, data.ttlMs);
  }

  @MessagePattern('ftp.getDataTmp')
  async getDataTmp(data: { path: string; name: string }) {
    return await this.ftp.getDataTmp(data.path, data.name);
  }

  @MessagePattern('ftp.removeDataTmp')
  async removeDataTmp(data: { path: string; name: string }) {
    return await this.ftp.removeDataTmp(data.path, data.name);
  }

  @MessagePattern('ftp.removeFile')
  async removeFile(data: string[]) {
    return await this.ftp.removeFile(data);
  }

  @MessagePattern('sms.send')
  async sendSms(data: SmsDto) {
    return await this.sms.send(data);
  }

  @MessagePattern('whatsapp.send')
  async whatsappSms(data: WhatsappDto) {
    return await this.whatsapp.send(data);
  }

  @MessagePattern('citizenshipDigital.credentials')
  async citizenshipDigitalCredentials() {
    return await this.citizenshipDigital.citizenshipDigitalCredentials();
  }

  @MessagePattern('citizenshipDigital.findPerson')
  async findPerson(data: any) {
    return await this.citizenshipDigital.findPerson(data);
  }

  @MessagePattern('bcb.generateQr')
  async generateQr(@Payload() data: any) {
    return await this.handleBcbRequest(() => this.bcbService.generateQr(data));
  }

  @MessagePattern('bcb.qrStatus')
  async qrStatus(@Payload() data: string | { qrId?: string; idQr?: string; idQR?: string }) {
    return await this.handleBcbRequest(() => {
      const qrId = typeof data === 'string' ? data : (data?.qrId ?? data?.idQr ?? data?.idQR);
      return this.bcbService.qrStatus(qrId);
    });
  }

  @MessagePattern('bcb.status')
  async bcbStatusMessage() {
    return await this.handleBcbRequest(() => this.bcbService.status());
  }

  @MessagePattern('bcb.entities')
  async bcbEntitiesMessage() {
    return await this.handleBcbRequest(() => this.bcbService.entities());
  }

  @MessagePattern('bcb.createAccount')
  async createBcbAccount(@Payload() data: any) {
    return await this.handleBcbRequest(() => this.bcbService.createAccount(data));
  }

  @MessagePattern('bcb.updateAccount')
  async updateBcbAccount(@Payload() data: any) {
    return await this.handleBcbRequest(() => {
      const cta = data?.cta ?? data?.cuenta ?? data?.accountNumber;
      const payload = data?.data ?? data;
      return this.bcbService.updateAccount(cta, payload);
    });
  }

  @Get('bcb.entities')
  @ApiOperation({ summary: 'Obtener datos de entidad BCB' })
  async entities() {
    return await this.handleBcbRequest(() => this.bcbService.entities());
  }

  @Post('bcb.accounts')
  @ApiOperation({ summary: 'Crear cuenta BCB' })
  @ApiBody({
    description:
      'Datos de la cuenta a registrar en BCB. eifCuenta es la cuenta de la Entidad Financiera; cta no se envia en creacion, lo devuelve BCB como cuenta transitoria.',
    required: true,
    schema: {
      type: 'object',
      required: ['eif', 'eifCuenta', 'ciNitTitular', 'nombreTitular'],
      properties: {
        eif: {
          type: 'string',
          description: 'Codigo del participante en el MLD de la Entidad Financiera.',
          example: 'MLD1014',
        },
        eifCuenta: {
          type: 'string',
          description: 'Numero de cuenta de la Entidad Financiera.',
          example: '1505651746',
        },
        ciNitTitular: {
          type: 'string',
          description: 'Numero de documento o NIT del titular de la cuenta.',
          example: '234578021',
        },
        nombreTitular: {
          type: 'string',
          description: 'Nombre o razon social del titular de la cuenta.',
          example: 'NAMEPRUEBA',
        },
        estado: {
          type: 'string',
          description: 'Estado de la cuenta.',
          enum: ['ACTIVO', 'INACTIVO'],
          example: 'ACTIVO',
        },
      },
      example: {
        eif: 'MLD1014',
        eifCuenta: '1505651746',
        ciNitTitular: '234578021',
        nombreTitular: 'NAMEPRUEBA',
        estado: 'ACTIVO',
      },
    },
  })
  async createAccount(@Body() data: any) {
    return await this.handleBcbRequest(() => this.bcbService.createAccount(data));
  }

  @Put('bcb.accounts/:cta')
  @ApiOperation({ summary: 'Actualizar cuenta BCB' })
  @ApiParam({
    name: 'cta',
    required: true,
    description: 'Cuenta transitoria devuelta por BCB al crear la cuenta.',
    example: '130008101400006',
  })
  @ApiBody({
    description:
      'Datos de la cuenta a actualizar en BCB. cta va en la URL; no debe enviarse en el body.',
    required: true,
    schema: {
      type: 'object',
      properties: {
        eif: {
          type: 'string',
          description: 'Codigo del participante en el MLD de la Entidad Financiera.',
          example: 'MLD1014',
        },
        eifCuenta: {
          type: 'string',
          description: 'Numero de cuenta de la Entidad Financiera.',
          example: '1505651746',
        },
        ciNitTitular: {
          type: 'string',
          description: 'Numero de documento o NIT del titular de la cuenta.',
          example: '234578021',
        },
        nombreTitular: {
          type: 'string',
          description: 'Nombre o razon social del titular de la cuenta.',
          example: 'NAMEPRUEBA EDITADO',
        },
        estado: {
          type: 'string',
          description: 'Estado de la cuenta.',
          enum: ['ACTIVO', 'INACTIVO'],
          example: 'ACTIVO',
        },
      },
      example: {
        eif: 'MLD1014',
        eifCuenta: '1505651746',
        ciNitTitular: '234578021',
        nombreTitular: 'NAMEPRUEBA EDITADO',
        estado: 'ACTIVO',
      },
    },
  })
  async updateAccount(@Param('cta') cta: string, @Body() data: any) {
    return await this.handleBcbRequest(() => this.bcbService.updateAccount(cta, data));
  }

  @Get('bcb.status')
  @ApiOperation({ summary: 'Verificar disponibilidad BCB' })
  async bcbStatus() {
    return await this.handleBcbRequest(() => this.bcbService.status());
  }

  private async handleBcbRequest<T>(request: () => Promise<T>) {
    try {
      return await request();
    } catch (error) {
      return this.bcbService.buildErrorResponse(error);
    }
  }
}
