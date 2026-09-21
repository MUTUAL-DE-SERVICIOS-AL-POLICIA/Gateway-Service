import { Type } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export enum BcbQrStatus {
  PROCESADO = 'PROCESADO',
  RECHAZADO = 'RECHAZADO',
  NO_PROCESADO = 'NO PROCESADO',
}

export const BCB_QR_STATUSES: BcbQrStatus[] = Object.values(BcbQrStatus);

export class BcbPaymentNotificationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  idQR: string;

  @ValidateIf((notification) => notification.estado === BcbQrStatus.PROCESADO)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  idOrdenDestinatario?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  eif: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  ciNitOriginante?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  nombreOriginante?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(3)
  codMoneda: string;

  @ValidateIf((notification) => notification.estado === BcbQrStatus.PROCESADO)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  importe?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  cuentaOrigen?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  eifOrigen?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  tipoNotificacion?: string;

  @IsString()
  @IsIn(BCB_QR_STATUSES)
  estado: BcbQrStatus;

  @IsObject()
  metaData: Record<string, unknown>;
}
