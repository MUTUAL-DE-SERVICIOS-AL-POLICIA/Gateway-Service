import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { NatsService } from 'src/common';

@ApiTags('records')
@Controller('records')
export class RecordsController {
  constructor(private readonly nats: NatsService) {}

  @Get('appMobile/:affiliateId')
  async findAllAppMobile(@Param('affiliateId') affiliateId: string) {
    return this.nats.firstValue('records.findAllAppMobile', { affiliateId });
  }
}
