import { describe, expect, it } from 'vitest';

import type { DeliveryQueue } from '../../delivery/application/ports/delivery-queue.port';
import type { Delivery } from '../../delivery/domain/delivery';
import type { SubscriberRepository } from '../../subscriptions/application/ports/subscriber-repository.port';
import type { Subscriber } from '../../subscriptions/domain/subscriber';
import { hashPayload } from '../domain/payload-hash';
import { IngestEventUseCase } from './ingest-event.use-case';
import type { EventRepository, IngestEventResult } from './ports/event-repository.port';

function makeSubscriber(overrides: Partial<Subscriber> = {}): Subscriber {
  return {
    id: 'sub_1',
    name: 'Test',
    targetUrl: 'https://example.com/hook',
    secretEncrypted: 'enc',
    previousSecretEncrypted: null,
    previousSecretExpiresAt: null,
    eventTypes: ['order.created'],
    isActive: true,
    timeoutMs: 10_000,
    maxRetries: 8,
    rateLimitPerSec: 5,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

class FakeSubscriberRepository implements SubscriberRepository {
  constructor(private readonly matches: Subscriber[]) {}

  async create(): Promise<Subscriber> {
    throw new Error('not implemented');
  }

  async findById(): Promise<Subscriber | null> {
    return null;
  }

  async findActiveByEventType(eventType: string): Promise<Subscriber[]> {
    return this.matches.filter((subscriber) => subscriber.eventTypes.includes(eventType));
  }

  async list(): Promise<Subscriber[]> {
    return this.matches;
  }

  async update(): Promise<Subscriber | null> {
    return null;
  }

  async delete(): Promise<boolean> {
    return false;
  }

  async rotateSecret(): Promise<Subscriber | null> {
    return null;
  }
}

class FakeEventRepository implements EventRepository {
  calls: Array<{ subscriberIds: readonly string[] }> = [];

  constructor(private readonly result: IngestEventResult) {}

  async ingest(
    _input: Parameters<EventRepository['ingest']>[0],
    subscriberIds: readonly string[],
  ): Promise<IngestEventResult> {
    this.calls.push({ subscriberIds });
    return this.result;
  }
}

class FakeDeliveryQueue implements DeliveryQueue {
  enqueued: string[] = [];

  async enqueue(deliveryId: string): Promise<void> {
    this.enqueued.push(deliveryId);
  }

  async retry(deliveryId: string): Promise<void> {
    this.enqueued.push(deliveryId);
  }
}

describe('IngestEventUseCase', () => {
  it('fans out one delivery per matching active subscriber and enqueues each', async () => {
    const subscriber = makeSubscriber();
    const delivery: Delivery = {
      id: 'del_1',
      eventId: 'evt_1',
      subscriberId: subscriber.id,
      status: 'pending',
      attemptCount: 0,
      nextAttemptAt: null,
      createdAt: new Date(),
      completedAt: null,
    };

    const subscribers = new FakeSubscriberRepository([subscriber]);
    const events = new FakeEventRepository({
      event: {
        id: 'evt_1',
        eventType: 'order.created',
        payload: { orderId: '123' },
        idempotencyKey: 'idem_1',
        payloadHash: hashPayload({ orderId: '123' }),
        occurredAt: new Date(),
        createdAt: new Date(),
      },
      deliveries: [delivery],
      alreadyIngested: false,
    });
    const queue = new FakeDeliveryQueue();

    const useCase = new IngestEventUseCase(events, subscribers, queue);
    const result = await useCase.execute({
      eventType: 'order.created',
      payload: { orderId: '123' },
      idempotencyKey: 'idem_1',
    });

    expect(events.calls[0]?.subscriberIds).toEqual([subscriber.id]);
    expect(queue.enqueued).toEqual([delivery.id]);
    expect(result.alreadyIngested).toBe(false);
  });

  it('does not re-enqueue deliveries for an already-ingested (duplicate) event', async () => {
    const events = new FakeEventRepository({
      event: {
        id: 'evt_1',
        eventType: 'order.created',
        payload: {},
        idempotencyKey: 'idem_1',
        payloadHash: hashPayload({}),
        occurredAt: new Date(),
        createdAt: new Date(),
      },
      deliveries: [],
      alreadyIngested: true,
    });
    const subscribers = new FakeSubscriberRepository([]);
    const queue = new FakeDeliveryQueue();

    const useCase = new IngestEventUseCase(events, subscribers, queue);
    await useCase.execute({ eventType: 'order.created', payload: {}, idempotencyKey: 'idem_1' });

    expect(queue.enqueued).toEqual([]);
  });

  it('only enqueues subscribers matching the event type', async () => {
    const matching = makeSubscriber({ id: 'sub_match', eventTypes: ['order.created'] });
    const nonMatching = makeSubscriber({ id: 'sub_other', eventTypes: ['order.cancelled'] });

    const subscribers = new FakeSubscriberRepository([matching, nonMatching]);
    const events = new FakeEventRepository({
      event: {
        id: 'evt_1',
        eventType: 'order.created',
        payload: {},
        idempotencyKey: 'idem_1',
        payloadHash: hashPayload({}),
        occurredAt: new Date(),
        createdAt: new Date(),
      },
      deliveries: [],
      alreadyIngested: false,
    });
    const queue = new FakeDeliveryQueue();

    const useCase = new IngestEventUseCase(events, subscribers, queue);
    await useCase.execute({ eventType: 'order.created', payload: {}, idempotencyKey: 'idem_1' });

    expect(events.calls[0]?.subscriberIds).toEqual(['sub_match']);
  });
});
