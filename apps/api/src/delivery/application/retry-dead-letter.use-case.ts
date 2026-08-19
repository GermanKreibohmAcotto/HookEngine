import { Inject, Injectable } from '@nestjs/common';

import { DELIVERY_QUEUE, type DeliveryQueue } from './ports/delivery-queue.port';
import { DELIVERY_REPOSITORY, type DeliveryRepository } from './ports/delivery-repository.port';

export interface BulkRetryResult {
  readonly retried: readonly string[];
  readonly notFound: readonly string[];
}

@Injectable()
export class RetryDeadLetterUseCase {
  constructor(
    @Inject(DELIVERY_REPOSITORY) private readonly deliveries: DeliveryRepository,
    @Inject(DELIVERY_QUEUE) private readonly queue: DeliveryQueue,
  ) {}

  /** Returns false if the delivery doesn't exist or isn't currently dead. */
  async execute(deliveryId: string): Promise<boolean> {
    const reset = await this.deliveries.resetForRetry(deliveryId);
    if (!reset) {
      return false;
    }
    await this.queue.retry(deliveryId);
    return true;
  }

  async executeBulk(deliveryIds: readonly string[]): Promise<BulkRetryResult> {
    const retried: string[] = [];
    const notFound: string[] = [];

    for (const deliveryId of deliveryIds) {
      const ok = await this.execute(deliveryId);
      (ok ? retried : notFound).push(deliveryId);
    }

    return { retried, notFound };
  }
}
