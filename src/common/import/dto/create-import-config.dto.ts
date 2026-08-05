import { IsString, IsNumber, IsArray, IsOptional, IsBoolean, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ColumnMapping } from '../entities/import-config.entity';

class ColumnMappingDto implements ColumnMapping {
  @ApiProperty({ example: 2, description: 'Índice de columna (1-based)' })
  @IsNumber()
  @Min(1)
  columnIndex: number;

  @ApiProperty({ example: 'date', description: 'Nombre del campo en el DTO/entidad' })
  @IsString()
  fieldName: string;
}

export class CreateImportConfigDto {
  @ApiProperty({ example: 'extractos_bancarios', description: 'Nombre único (se usa en la URL: POST /import/:name)' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'collections', description: 'Microservicio destino (ej: collections, sales, loans)' })
  @IsString()
  microservice: string;

  @ApiProperty({ example: 'collections', description: 'Schema de PostgreSQL donde está la tabla' })
  @IsString()
  schema: string;

  @ApiProperty({ example: 'bank_statements', description: 'Nombre exacto de la tabla en PostgreSQL' })
  @IsString()
  table: string;

  @ApiPropertyOptional({ example: 2, description: 'Filas a saltar al inicio del archivo (encabezados, basura)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  skipRows?: number;

  @ApiPropertyOptional({ example: 2, description: 'Columna desde donde empezar a leer (1-based)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  startColumn?: number;

  @ApiPropertyOptional({
    example: [
      { columnIndex: 2, fieldName: 'date' },
      { columnIndex: 6, fieldName: 'documentNumber' },
    ],
    description: 'Mapeo de columnas del archivo a campos de la entidad',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ColumnMappingDto)
  columnMappings?: ColumnMappingDto[];

  @ApiPropertyOptional({ example: ',', description: 'Delimitador CSV (solo aplica a archivos .csv)' })
  @IsOptional()
  @IsString()
  delimiter?: string;

  @ApiPropertyOptional({ example: true, description: 'Activar/desactivar esta configuración' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
