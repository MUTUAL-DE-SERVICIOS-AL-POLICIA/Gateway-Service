import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { whatsappEnvs } from 'src/config/envs';
import { firstValueFrom } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import { WhatsappDto } from 'src/common';

@Injectable()
export class WhatsappService {
  private readonly urlWhatsapp = whatsappEnvs.whatsappServerUrl;
  constructor(private readonly httpService: HttpService) {}

  async send(body: WhatsappDto) {
    try {
      const data = {
        cellphone: body.cellphone,
        message: body.message,
      };

      const url = `${this.urlWhatsapp}/whatsapp/send`;
      const response = await firstValueFrom(this.httpService.post(url, data));

      const { id } = response.data;
      const messageId = id.id;
      return {
        error: false,
        message: 'Mensaje enviado por whatsapp',
        messageId: messageId,
      };
    } catch (error) {
      console.error('Error capturado:', error?.message || error);
      if (error.response) {
        console.error('Respuesta del error:', error.response?.data);
      }
      throw new HttpException('Error enviando whatsapp', HttpStatus.BAD_GATEWAY);
    }
  }
}
