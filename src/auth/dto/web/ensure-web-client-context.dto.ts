import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength } from 'class-validator';

export class EnsureWebClientContextDto {
  @ApiProperty({
    description: 'Clave de herramienta resuelta por el catálogo de Auth; no concede autorización',
    example: 'beneficiary',
    maxLength: 64,
  })
  @IsString()
  @MaxLength(64)
  @Matches(/^[a-z][a-z0-9-]{0,63}$/)
  tool: string;
}
