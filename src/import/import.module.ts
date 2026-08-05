import { Module } from '@nestjs/common';
import { ImportController } from './import.controller';
import { ImportConfigController } from './import-config.controller';
import { ImportGatewayService } from './import.service';

@Module({
  controllers: [ImportConfigController, ImportController],
  providers: [ImportGatewayService],
})
export class ImportModule {}
