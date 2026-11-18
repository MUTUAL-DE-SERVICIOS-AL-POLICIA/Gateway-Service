import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class CheckWebSessionDto {
  @ApiProperty({ description: 'Identificador opaco de sesión web' })
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{43,128}$/)
  sid: string;
}
