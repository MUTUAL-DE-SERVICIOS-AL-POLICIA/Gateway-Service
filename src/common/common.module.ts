import { Global, Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { NATS_SERVICE, NastEnvs } from 'src/config';
import { NatsService, RecordService, FtpService, SmsService } from './';
import { auditLogger } from 'src/config/winston-audit-logger';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { CommonController } from './common.controller';
import { HttpModule } from '@nestjs/axios';

@Global()
@Module({
  controllers: [CommonController],
  imports: [
    ClientsModule.register([
      {
        name: NATS_SERVICE,
        transport: Transport.NATS,
        options: {
          servers: NastEnvs.natsServers,
        },
      },
    ]),
    HttpModule,
  ],
  providers: [
    NatsService,
    RecordService,
    FtpService,
    SmsService,
    { provide: WINSTON_MODULE_PROVIDER, useValue: auditLogger },
  ],
  exports: [ClientsModule, NatsService, RecordService, FtpService, SmsService, HttpModule],
})
export class CommonModule {}


    const apiToken = authHeader.split(' ')[1];

    const response = await this.nats.firstValue('auth.verifyApiTokenAppMobile', { apiToken });

    const { error, message } = response;

    if (error) {
      throw new UnauthorizedException({ error: true, message: 'Sin autorización, ' + message });
    }
    const user = {
      affiliateId: response.affiliateId,
      tokenId: response.tokenId,
    };

    request.user = user;