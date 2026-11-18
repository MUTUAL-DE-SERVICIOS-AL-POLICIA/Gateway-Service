import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength } from 'class-validator';

export class StartWebLoginDto {
  @ApiProperty({ description: 'Ruta relativa permitida dentro del Hub' })
  @IsString()
  @MaxLength(2048)
  @Matches(/^\/apphub(?:\/[^?#\\]*)?(?:\?[^#\\]*)?$/)
  returnPath: string;

  @ApiProperty({ description: 'Vínculo opaco de la sesión del navegador' })
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{43,128}$/)
  browserBinding: string;
}
