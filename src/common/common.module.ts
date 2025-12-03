import { Global, Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { NATS_SERVICE, NastEnvs } from 'src/config';
import { NatsService, RecordService, FtpService, SmsService, WhatsappService } from 'src/common';
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
    WhatsappService,
    { provide: WINSTON_MODULE_PROVIDER, useValue: auditLogger },
  ],
  exports: [ClientsModule, NatsService, RecordService, FtpService, SmsService, WhatsappService, HttpModule],
})
export class CommonModule {}
