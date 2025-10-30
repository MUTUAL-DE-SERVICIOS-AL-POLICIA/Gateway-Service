import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsString } from 'class-validator';

export class SaveDataKioskAuthDto {
  @ApiProperty({ description: 'Carnet de identidad', example: 'key1' })
  @IsString()
  identity_card: string;

  @ApiProperty({ description: 'id de persona', example: 1 })
  @IsInt()
  person_id: number;

  @ApiProperty({ description: 'texto izquierdo del carnet', example: 'value1' })
  @IsString()
  left_text: string;

  @ApiProperty({ description: 'texto derecho del carnet', example: 'value1' })
  @IsString()
  right_text: string;

  @ApiProperty({ description: 'texto reconocido', example: 'value1' })
  @IsString()
  recognized_text_captured: string;

  @ApiProperty({ description: '', example: true })
  @IsBoolean()
  ocr_state: boolean;

  @ApiProperty({ description: '', example: true })
  @IsBoolean()
  facial_recognition: boolean;
}
