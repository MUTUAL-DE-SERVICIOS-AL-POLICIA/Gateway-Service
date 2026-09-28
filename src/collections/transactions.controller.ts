import { Controller, Get } from '@nestjs/common';

import { ApiResponse, ApiTags } from '@nestjs/swagger';

import { NatsService } from 'src/common';
import { WebController, WebSessionOnly } from 'src/auth/decorators/web-authorization.decorators';

@ApiTags('collections')
@WebController('collections', 'transactions')
@Controller('collections/transactions')
export class TransactionsController {
  constructor(private readonly nats: NatsService) {}

  @Get('findAll')
  @WebSessionOnly()
  @ApiResponse({
    status: 200,
    description: 'Obtener todas las transacciones',
  })
  async findAll() {
    return this.nats.send('collections.findAll', {});
  }
}
