import { HttpException, Inject, Logger, RequestTimeoutException } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, Observable, TimeoutError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';
import { NATS_SERVICE } from '../../config';

export class NatsService {
  private logger = new Logger('MicroserviceUtils');

  constructor(@Inject(NATS_SERVICE) private readonly client: ClientProxy) {}

  async send(service: string, data: any): Promise<Observable<any>> {
    return this.client.send(service, data).pipe(
      catchError((err) => {
        if (!err || Object.keys(err).length === 0) {
          throw new HttpException('Microservice Unavailable', 503);
        }
        const status = typeof err.statusCode === 'number' ? err.statusCode : 500;
        throw new HttpException(err.message || err, status);
      }),
    );
  }

  /**
   * Envía un mensaje NATS request/reply con timeout.
   * Si el microservicio no responde en `timeoutMs`ms, lanza RequestTimeoutException.
   */
  async firstValue(service: string, data: any, timeoutMs = 30000): Promise<any> {
    const observable = await this.send(service, data);
    return firstValueFrom(
      observable.pipe(
        timeout(timeoutMs),
        catchError((err) => {
          if (err instanceof TimeoutError) {
            throw new RequestTimeoutException(
              `Microservicio "${service}" no respondió en ${timeoutMs / 1000}s`,
            );
          }
          throw err;
        }),
      ),
    );
  }

  async emit(service: string, data: any): Promise<void> {
    try {
      this.client.emit(service, data);
    } catch (error) {
      this.logger.error(`Failed to emit event to [${service}]`, error.stack);
      throw new HttpException('Event emit failed', 500);
    }
  }
}
