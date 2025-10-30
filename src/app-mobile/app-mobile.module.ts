import { Module } from '@nestjs/common';
import { AppMobileController } from './app-mobile.controller';

@Module({
  controllers: [AppMobileController],
  providers: [],
})
export class AppMobileModule {}
