import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiTags, ApiOperation, ApiBody, ApiParam } from '@nestjs/swagger';
import { ImportConfig } from 'src/common/import/entities/import-config.entity';
import { CreateImportConfigDto } from 'src/common/import/dto/create-import-config.dto';

@ApiTags('Import Configs')
@Controller('import/configs')
export class ImportConfigController {
  constructor(
    @InjectRepository(ImportConfig)
    private readonly repo: Repository<ImportConfig>,
  ) {}

  @ApiOperation({
    summary: 'Crear o actualizar configuración de importación',
    description:
      'Crea una nueva configuración o la actualiza si ya existe con el mismo name (upsert). '
      + 'Usar POST /api/import/configs con el JSON completo de la configuración.',
  })
  @ApiBody({
    type: CreateImportConfigDto,
    description: 'Configuración completa de importación',
  })
  @Post()
  async create(@Body() dto: CreateImportConfigDto) {
    const exists = await this.repo.findOne({ where: { name: dto.name } });
    if (exists) {
      await this.repo.update({ name: dto.name }, dto as any);
      return this.repo.findOne({ where: { name: dto.name } });
    }
    return this.repo.save(dto as any);
  }

  @ApiOperation({ summary: 'Listar todas las configuraciones' })
  @Get()
  findAll() {
    return this.repo.find({ order: { name: 'ASC' } });
  }

  @ApiOperation({ summary: 'Obtener una configuración por name' })
  @ApiParam({ name: 'name', description: 'Nombre único de la configuración' })
  @Get(':name')
  findOne(@Param('name') name: string) {
    return this.repo.findOneOrFail({ where: { name } });
  }

  @ApiOperation({ summary: 'Editar una configuración existente' })
  @ApiParam({ name: 'name', description: 'Nombre actual de la configuración' })
  @ApiBody({
    type: CreateImportConfigDto,
    description: 'Nuevos valores para la configuración',
  })
  @Put(':name')
  async update(@Param('name') name: string, @Body() dto: CreateImportConfigDto) {
    await this.repo.update({ name }, dto as any);
    return this.repo.findOneOrFail({ where: { name: dto.name || name } });
  }

  @ApiOperation({ summary: 'Eliminar una configuración' })
  @ApiParam({ name: 'name', description: 'Nombre de la configuración a eliminar' })
  @Delete(':name')
  async remove(@Param('name') name: string) {
    const config = await this.repo.findOneOrFail({ where: { name } });
    await this.repo.remove(config);
    return { message: `Configuración "${name}" eliminada` };
  }
}
