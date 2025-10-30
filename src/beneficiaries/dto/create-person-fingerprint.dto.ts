import { IsInt, IsNotEmpty, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

class FingerprintData {
  @ApiProperty({ description: 'ID del tipo de huella', example: 1 })
  @IsInt()
  @IsNotEmpty()
  fingerprintTypeId: number;

  @ApiProperty({ description: 'Calidad de la huella', example: 80 })
  @IsInt()
  @IsNotEmpty()
  quality: number;
}

class WsqFingerprintDto {
  [key: string]: string;
}

export class CreatePersonFingerprintDto {
  @ApiProperty({
    type: [FingerprintData],
    description: 'Lista de huellas digitales',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FingerprintData)
  personFingerprints: FingerprintData[];

  @ApiProperty({
    type: [WsqFingerprintDto],
    description: 'Lista de huellas digitales en formato WSQ',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WsqFingerprintDto)
  wsqFingerprints: WsqFingerprintDto[];
}
