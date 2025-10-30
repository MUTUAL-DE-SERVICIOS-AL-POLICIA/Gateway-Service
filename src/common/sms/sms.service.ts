import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { smsEnvs } from '../../config/envs';
import { firstValueFrom } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import { SmsDto } from '../';

@Injectable()
export class SmsService {
  private readonly sms = {
    url: smsEnvs.smsServerUrl,
    root: smsEnvs.smsServerRoot,
    password: smsEnvs.smsServerPassword,
    provider: smsEnvs.smsProvider,
  };
  private readonly logger = new Logger('FtpService');

  constructor(private readonly httpService: HttpService) {}

  async send(body: SmsDto) {
    const url = `${this.sms.url}dosend.php?USERNAME=${this.sms.root}&PASSWORD=${this.sms.password}&smsprovider=${this.sms.provider}&smsnum=${body.cellphone}&method=2&Memo=${encodeURIComponent(body.message)}`;

    try {
      const { data } = await firstValueFrom(this.httpService.get(url));

      if (typeof data === 'string' && data.toLowerCase().includes('error')) {
        this.logger.error(`Error al enviar SMS: ${data}`);
      }

      const match = data.match(/messageid=(\d+)/);
      const messageId = match ? match[1] : null;
      if (!messageId) {
        this.logger.error('No se pudo obtener el messageId del SMS enviado');
        throw new HttpException(
          'Error al enviar SMS: messageId no encontrado',
          HttpStatus.BAD_GATEWAY,
        );
      }
      const urlSend = `${this.sms.url}/resend.php?messageid=${messageId}&USERNAME=${this.sms.root}&PASSWORD=${this.sms.password}`;

      const { data: response } = await firstValueFrom(this.httpService.get(urlSend));

      if (response.includes('ERROR') || response.includes('errorstatus')) {
        this.logger.error(`Error al reenviar SMS: ${response}`);
        return { status: false, message: 'Error en el envío', messageId: '' };
      }

      return {
        status: true,
        message: 'SMS sent successfully',
        messageId: messageId,
      };
    } catch (error) {
      console.error('Error capturado:', error?.message || error);
      if (error.response) {
        console.error('Respuesta del error:', error.response?.data);
      }
      throw new HttpException('Error enviando SMS', HttpStatus.BAD_GATEWAY);
    }
  }
}
