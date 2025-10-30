import { Module } from '@nestjs/common';
import { PvtBeController } from './pvt-be.controller';
//import { HttpModule } from '@nestjs/axios';

@Module({
  controllers: [PvtBeController],
  providers: [],
  imports: [],
})
export class PvtBeModule {}
