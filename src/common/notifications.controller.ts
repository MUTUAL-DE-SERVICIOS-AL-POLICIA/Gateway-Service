import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';

import { BcbPaymentNotificationDto, BcbService } from 'src/common';
import { AuthBcbGuard } from 'src/auth/guards';
import { BCB_QR_STATUSES, BcbQrStatus } from './dto/bcb-payment-notification.dto';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly bcbService: BcbService) {}

  @ApiOperation({ summary: 'Recibir notificación BCB' })
  @ApiBody({
    description: 'Datos de respuesta del QR procesado',
    required: true,
    schema: {
      type: 'object',
      properties: {
        idQR: {
          type: 'string',
          example: '10000121715970417000',
        },
        idOrdenDestinatario: {
          type: 'string',
          example: '145266734545645630',
        },
        eif: {
          type: 'string',
          example: 'MLD1014',
        },
        ciNitOriginante: {
          type: 'string',
          example: '12345678',
        },
        nombreOriginante: {
          type: 'string',
          example: 'Juan Perez',
        },
        codMoneda: {
          type: 'string',
          example: 'BOB',
        },
        importe: {
          type: 'number',
          example: 20000,
        },
        cuentaOrigen: {
          type: 'string',
          example: '233333444',
        },
        eifOrigen: {
          type: 'string',
          example: 'MLD1014',
        },
        tipoNotificacion: {
          type: 'string',
          example: 'T1',
        },
        estado: {
          type: 'string',
          enum: BCB_QR_STATUSES,
          example: BcbQrStatus.PROCESADO,
        },
        metaData: {
          type: 'object',
          example: {
            origen: 'sales-service',
            schema: 'sales',
            message: 'bcbPaymentNotification',
            tipo: 'venta-qr',
            personId: '123',
          },
          additionalProperties: true,
        },
      },
      required: ['idQR', 'eif', 'codMoneda', 'estado', 'metaData'],
    },
  })
  @ApiBearerAuth('msp')
  @UseGuards(AuthBcbGuard)
  @Post('paymentQr')
  async paymentNotification(@Body() data: BcbPaymentNotificationDto) {
    return await this.bcbService.processPaymentNotification(data);
  }
}
