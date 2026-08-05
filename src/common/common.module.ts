import { Global, Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { NATS_SERVICE, NastEnvs } from 'src/config';
import {
  NatsService,
  FtpService,
  SmsService,
  WhatsappService,
  CitizenshipDigitalService,
} from 'src/common';
import { CommonController } from './common.controller';
import { HttpModule } from '@nestjs/axios';
import { ImportModule } from './import/import.module';

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
    ImportModule,
  ],
  providers: [
    NatsService,
    FtpService,
    SmsService,
    WhatsappService,
    CitizenshipDigitalService,
  ],
  exports: [
    ClientsModule,
    NatsService,
    FtpService,
    SmsService,
    WhatsappService,
    CitizenshipDigitalService,
    HttpModule,
    ImportModule,
  ],
})
export class CommonModule {}
