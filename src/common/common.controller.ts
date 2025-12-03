import { Controller, Post, UploadedFile, UseInterceptors, Body, UseGuards } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { WhatsappService, SmsService, FtpService, SmsDto, WhatsappDto } from 'src/common';
import { AuthGuard } from 'src/auth/guards';

@ApiTags('common')
@Controller('common')
export class CommonController {
  constructor(
    private readonly ftp: FtpService,
    private readonly sms: SmsService,
    private readonly whatsapp: WhatsappService,
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
  async saveDataTmp(data: { path: string; name: string; data: any }) {
    return await this.ftp.saveDataTmp(data.path, data.name, data.data);
  }

  @MessagePattern('ftp.getDataTmp')
  async getDataTmp(data: { path: string; name: string }) {
    return await this.ftp.getDataTmp(data.path, data.name);
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
}
