import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';

import { DELIVERY_EVENTS_CHANNEL } from '../../shared/redis/channels';
import { REDIS_CLIENT } from '../../shared/redis/redis.module';
import type {
  DeliveryEventPayload,
  DeliveryEventPublisher,
} from '../application/ports/delivery-event-publisher.port';

@Injectable()
export class RedisDeliveryEventPublisher implements DeliveryEventPublisher {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async publish(event: DeliveryEventPayload): Promise<void> {
    await this.redis.publish(DELIVERY_EVENTS_CHANNEL, JSON.stringify(event));
  }
}
