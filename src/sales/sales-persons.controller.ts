import { Controller, Get, Param, ParseUUIDPipe, UseInterceptors } from '@nestjs/common';
import { ApiResponse, ApiTags } from '@nestjs/swagger';
import { WebController, WebPermission } from 'src/auth/decorators/web-authorization.decorators';
import { NatsService, RecordsService } from 'src/common';

@ApiTags('sales')
@WebController('sales', 'persons')
@UseInterceptors(RecordsService)
@Controller('sales')
export class SalesPersonsController {
  constructor(private readonly nats: NatsService) {}

  @Get('search/:value/:type')
  @WebPermission('read')
  @ApiResponse({ status: 200, description: 'Buscar un afiliado' })
  searchPerson(@Param('value') value: string, @Param('type') type: string) {
    return this.nats.send('sales.searchPerson', { value, type });
  }

  @Get(':personUuid/forCreatingSale')
  @WebPermission('read')
  @ApiResponse({
    status: 200,
    description: 'Muestra una persona con sus relaciones y características adicionales',
  })
  findPerson(@Param('personUuid', new ParseUUIDPipe()) personUuid: string) {
    return this.nats.send('sales.forCreatingSale', { personUuid });
  }
}
