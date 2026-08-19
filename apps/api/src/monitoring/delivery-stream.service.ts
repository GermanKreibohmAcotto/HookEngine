import {
  Injectable,
  Logger,
  type MessageEvent,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { Subject, type Observable } from 'rxjs';

import type { Env } from '../shared/config/env.schema';
import { DELIVERY_EVENTS_CHANNEL } from '../shared/redis/channels';

/**
 * One dedicated Redis subscriber connection per HTTP process instance, fanned
 * out in-process to every connected SSE client via an RxJS Subject — not one
 * Redis subscription per browser tab. This is also what makes the stream work
 * behind a load balancer with multiple API instances: whichever instance the
 * worker's PUBLISH reaches doesn't matter, every instance is subscribed and
 * re-broadcasts to its own connected clients.
 */
@Injectable()
export class DeliveryStreamService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DeliveryStreamService.name);
  private readonly subject = new Subject<MessageEvent>();
  private subscriber: Redis | undefined;

  constructor(private readonly config: ConfigService<Env, true>) {}

  onModuleInit(): void {
    this.subscriber = new Redis(this.config.get('REDIS_URL', { infer: true }));
    this.subscriber.subscribe(DELIVERY_EVENTS_CHANNEL).catch((error: unknown) => {
      this.logger.error('Failed to subscribe to delivery events channel', error);
    });
    this.subscriber.on('message', (_channel: string, message: string) => {
      // No `type` here deliberately — an SSE frame with an `event:` field only
      // reaches an EventSource's addEventListener(type, ...), not the default
      // onmessage handler. Keeping this as the default "message" event is
      // simpler for the frontend and there's only one kind of event today.
      this.subject.next({ data: message });
    });
  }

  stream(): Observable<MessageEvent> {
    return this.subject.asObservable();
  }

  async onModuleDestroy(): Promise<void> {
    await this.subscriber?.quit();
    this.subject.complete();
  }
}
