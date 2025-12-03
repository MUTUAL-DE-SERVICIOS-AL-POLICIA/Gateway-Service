import { ApiProperty } from '@nestjs/swagger';

export class WhatsappDto {
  @ApiProperty({ example: '59171931166', description: 'Número de celular con código de país' })
  cellphone: string;

  @ApiProperty({ example: 'test', description: 'Contenido del mensaje SMS' })
  message: string;
}
