import { Injectable, Inject } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';

@Injectable()
export class RecordService {
  constructor(@Inject(WINSTON_MODULE_PROVIDER) private readonly auditLogger: Logger) {}

  http(
    action: string,
    user: string,
    record_type_id: number,
    recordable_id: number,
    recordable_type: string,
  ) {
    this.auditLogger.http(action, {
      user: user,
      record_type_id,
      recordable_id,
      recordable_type,
      action,
    });
  }
  debug(message: any) {
    this.auditLogger.debug(message);
  }
  info(message: any) {
    this.auditLogger.info(message);
  }
  warn(message: any) {
    this.auditLogger.warn(message);
  }
  error(message: any) {
    this.auditLogger.error(message);
  }
}
