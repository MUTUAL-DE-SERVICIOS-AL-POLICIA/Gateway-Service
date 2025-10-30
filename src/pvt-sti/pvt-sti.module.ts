import { Module } from '@nestjs/common';
import { PvtStiController } from './pvt-sti.controller';
//import { HttpModule } from '@nestjs/axios';

@Module({
  controllers: [PvtStiController],
  providers: [],
  imports: [],
})
export class PvtStiModule {}
