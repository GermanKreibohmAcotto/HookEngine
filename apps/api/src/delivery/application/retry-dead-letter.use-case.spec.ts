import { describe, expect, it } from 'vitest';

import type { DeliveryQueue } from './ports/delivery-queue.port';
import type {
  DeliveryPage,
  DeliveryRepository,
  DeliveryWithAttempts,
  DeliveryWithContext,
  Pagination,
  RecordAttemptInput,
} from './ports/delivery-repository.port';
import { RetryDeadLetterUseCase } from './retry-dead-letter.use-case';

class FakeDeliveryRepository implements DeliveryRepository {
  constructor(private readonly deadIds: Set<string>) {}

  async findWithContext(): Promise<DeliveryWithContext | null> {
    return null;
  }

  async recordAttempt(_input: RecordAttemptInput): Promise<void> {}

  async listDead(_pagination: Pagination): Promise<DeliveryPage> {
    return { items: [], total: 0 };
  }

  async resetForRetry(deliveryId: string): Promise<boolean> {
    if (this.deadIds.has(deliveryId)) {
      this.deadIds.delete(deliveryId);
      return true;
    }
    return false;
  }

  async list(): Promise<DeliveryPage> {
    return { items: [], total: 0 };
  }

  async getWithAttempts(): Promise<DeliveryWithAttempts | null> {
    return null;
  }
}

class FakeDeliveryQueue implements DeliveryQueue {
  retried: string[] = [];

  async enqueue(): Promise<void> {}

  async retry(deliveryId: string): Promise<void> {
    this.retried.push(deliveryId);
  }
}

describe('RetryDeadLetterUseCase', () => {
  it('resets and re-enqueues a dead delivery', async () => {
    const deliveries = new FakeDeliveryRepository(new Set(['del_1']));
    const queue = new FakeDeliveryQueue();
    const useCase = new RetryDeadLetterUseCase(deliveries, queue);

    const result = await useCase.execute('del_1');

    expect(result).toBe(true);
    expect(queue.retried).toEqual(['del_1']);
  });

  it('returns false and does not touch the queue for a delivery that is not dead', async () => {
    const deliveries = new FakeDeliveryRepository(new Set());
    const queue = new FakeDeliveryQueue();
    const useCase = new RetryDeadLetterUseCase(deliveries, queue);

    const result = await useCase.execute('missing');

    expect(result).toBe(false);
    expect(queue.retried).toEqual([]);
  });

  it('retries a bulk list and reports which ones were not found', async () => {
    const deliveries = new FakeDeliveryRepository(new Set(['del_1', 'del_2']));
    const queue = new FakeDeliveryQueue();
    const useCase = new RetryDeadLetterUseCase(deliveries, queue);

    const result = await useCase.executeBulk(['del_1', 'del_2', 'del_missing']);

    expect(result.retried).toEqual(['del_1', 'del_2']);
    expect(result.notFound).toEqual(['del_missing']);
    expect(queue.retried).toEqual(['del_1', 'del_2']);
  });
});
