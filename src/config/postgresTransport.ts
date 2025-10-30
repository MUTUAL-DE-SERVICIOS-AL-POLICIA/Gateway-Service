import { TransportStreamOptions } from 'winston-transport';
import * as Transport from 'winston-transport';
import { Client } from 'pg';

interface PostgresTransportOptions extends TransportStreamOptions {
  client: Client;
}

export class PostgresTransport extends Transport {
  private client: Client;

  constructor(options: PostgresTransportOptions) {
    super(options);
    this.client = options.client;
  }

  async log(info: any, callback: () => void) {
    setImmediate(() => this.emit('logged', info));

    if (info.level == 'http') {
      const query = `
            INSERT INTO beneficiaries.records
            ("user", record_type_id, recordable_id, recordable_type, "action")
            VALUES($1, $2, $3, $4, $5);
        `;
      const values = [
        info.user,
        info.record_type_id,
        info.recordable_id,
        info.recordable_type,
        info.action,
      ];

      try {
        await this.client.query(query, values);
      } catch (error) {
        console.error('Error logging to PostgreSQL:', error);
      }
    }

    callback();
  }
}
