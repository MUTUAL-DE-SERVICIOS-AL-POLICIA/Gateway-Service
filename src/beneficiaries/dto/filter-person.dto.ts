import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from 'src/common/dto/pagination.dto';

export class FilteredPaginationDto extends PartialType(PaginationDto) {
  @ApiPropertyOptional({ description: 'Texto para filtrar resultados' })
  @IsString()
  @IsOptional()
  filter?: string;

  @ApiPropertyOptional({ description: 'Campo por el que se ordenarán los resultados' })
  @IsString()
  @IsOptional()
  orderBy?: string;

  @ApiPropertyOptional({
    description: 'Orden de los resultados',
    enum: ['ASC', 'DESC'],
    default: 'ASC',
  })
  @IsString()
  @IsOptional()
  order?: 'ASC' | 'DESC' = 'ASC';
}
