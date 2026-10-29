import { Module } from '@nestjs/common';

import { AuthController } from './auth.controller';
import { WebAuthController } from './web-auth.controller';
import { WebAuthExceptionFilter } from './filters/web-auth-exception.filter';

@Module({
  controllers: [AuthController, WebAuthController],
  imports: [],
  providers: [WebAuthExceptionFilter],
})
export class AuthModule {}
