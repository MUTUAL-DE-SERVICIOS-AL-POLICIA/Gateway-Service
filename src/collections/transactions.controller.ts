import {
  Controller,
  Get,
  Param,
  UseGuards,
} from '@nestjs/common';

import {
  ApiBearerAuth,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { NatsService } from 'src/common';
import { AuthGuard } from 'src/auth/guards';

@ApiTags('collections')
@ApiBearerAuth('msp')
@UseGuards(AuthGuard)
@Controller('collections/transactions')
export class TransactionsController {
  constructor(
    private readonly nats: NatsService,
  ) {}

  @Get('findAll')
  @ApiResponse({
    status: 200,
    description: 'Obtener todas las transacciones',
  })
  async findAll() {
    return this.nats.send('collections.findAll', {});
  }

}






