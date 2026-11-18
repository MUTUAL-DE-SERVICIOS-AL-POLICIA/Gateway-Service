import { firstValueFrom, timeout } from 'rxjs';
import { NatsService } from 'src/common/services/nats.service';

export async function webNatsRequest<T>(
  nats: NatsService,
  pattern: string,
  payload: unknown,
  timeoutMs: number,
): Promise<T> {
  const source = await nats.send(pattern, payload);
  return firstValueFrom(source.pipe(timeout({ first: timeoutMs })));
}
