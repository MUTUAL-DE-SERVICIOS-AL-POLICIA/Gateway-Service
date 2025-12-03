import { Controller, Get, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiResponse, ApiTags } from '@nestjs/swagger';
import { NatsService } from 'src/common';
import { AuthGuard } from 'src/auth/guards/auth.guard';
import { Records } from 'src/records/records.interceptor';

@ApiTags('beneficiaries')
@UseGuards(AuthGuard)
@UseInterceptors(Records)
@Controller('beneficiaries')
export class BeneficiariesController {
  constructor(private readonly nats: NatsService) {}

  @Get('fileDossiers')
  @ApiResponse({ status: 200, description: 'Obtener todos los tipos de expedients' })
  async findAllFileDossiers() {
    return this.nats.send('affiliate.findAllFileDossiers', []);
  }

  @Get('documents')
  @ApiResponse({ status: 200, description: 'Obtener todos los tipos de documentos' })
  async findAllDocuments() {
    return this.nats.send('affiliate.findAllDocuments', []);
  }
}
