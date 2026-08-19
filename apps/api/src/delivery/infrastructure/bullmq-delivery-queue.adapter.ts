import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import type Redis from 'ioredis';

import { REDIS_CLIENT } from '../../shared/redis/redis.module';
import type { DeliveryQueue } from '../application/ports/delivery-queue.port';

export const DELIVERY_QUEUE_NAME = 'delivery';

/** Any string other than BullMQ's builtin 'fixed'/'exponential' routes to our custom backoffStrategy. */
export const DELIVERY_BACKOFF_TYPE = 'delivery-full-jitter';

/**
 * A generous safety ceiling on top of BullMQ's own attempt counter — the real
 * business retry budget is each subscriber's `maxRetries`, enforced inside
 * ProcessDeliveryUseCase on every invocation. This just stops a runaway job
 * from retrying forever if that logic is ever bypassed.
 */
const MAX_JOB_ATTEMPTS = 50;

export interface DeliveryJobData {
  readonly deliveryId: string;
}

@Injectable()
export class BullmqDeliveryQueue implements DeliveryQueue, OnModuleDestroy {
  private readonly queue: Queue<DeliveryJobData>;

  constructor(@Inject(REDIS_CLIENT) redis: Redis) {
    // Shared, non-blocking connection — safe across multiple Queue producers,
    // and queue.close() below does not close a connection it doesn't own.
    this.queue = new Queue(DELIVERY_QUEUE_NAME, { connection: redis });
  }

  async enqueue(deliveryId: string): Promise<void> {
    // jobId = deliveryId gives free dedup if enqueue is ever called twice for the same delivery.
    await this.queue.add(
      'deliver',
      { deliveryId },
      {
        jobId: deliveryId,
        attempts: MAX_JOB_ATTEMPTS,
        backoff: { type: DELIVERY_BACKOFF_TYPE },
      },
    );
  }

  async retry(deliveryId: string): Promise<void> {
    // BullMQ ignores add() for a jobId that already exists (e.g. a completed
    // job from the original delivery attempt) — remove it first so the retry
    // isn't silently dropped. remove() is a safe no-op if nothing is there.
    await this.queue.remove(deliveryId);
    await this.enqueue(deliveryId);
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }
}
