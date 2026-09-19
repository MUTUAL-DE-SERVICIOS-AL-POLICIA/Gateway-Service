import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ExchangeWebCodeDto {
  @ApiProperty({ description: 'Código de autorización OIDC' })
  @IsString()
  @MinLength(1)
  @MaxLength(4096)
  code: string;

  @ApiProperty({ description: 'Estado opaco del flujo OIDC' })
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{43,128}$/)
  state: string;

  @ApiProperty({ description: 'Vínculo opaco de la sesión del navegador' })
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{43,128}$/)
  browserBinding: string;
}
