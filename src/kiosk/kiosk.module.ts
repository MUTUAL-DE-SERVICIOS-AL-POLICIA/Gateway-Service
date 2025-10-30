import { Module } from '@nestjs/common';
import { KioskController } from './kiosk.controller';
import { HttpModule } from '@nestjs/axios';

@Module({
  controllers: [KioskController],
  providers: [],
  imports: [HttpModule],
})
export class KioskModule {}
