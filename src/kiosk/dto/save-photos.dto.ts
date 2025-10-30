import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

export class UploadPhotosDto {
  @ApiProperty({ description: 'id de persona', example: 1 })
  @IsInt()
  @Transform(({ value }) => parseInt(value, 10))
  personId: number;

  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Foto del carnet de identidad',
    nullable: true,
  })
  @IsOptional()
  photoIdentityCard?: any;

  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Foto del rostro',
    nullable: true,
  })
  @IsOptional()
  photoFace?: any;
}
