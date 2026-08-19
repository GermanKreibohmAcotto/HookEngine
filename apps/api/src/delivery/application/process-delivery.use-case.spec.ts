import { describe, expect, it } from 'vitest';

import type { WebhookEvent } from '../../events/domain/event';
import type { Subscriber } from '../../subscriptions/domain/subscriber';
import { DeferredError } from '../domain/deferred-error';
import type { Delivery } from '../domain/delivery';
import { RetryableDeliveryError } from '../domain/retryable-delivery-error';
import type {
  DeliveryEventPayload,
  DeliveryEventPublisher,
} from './ports/delivery-event-publisher.port';
import type {
  DeliveryRepository,
  DeliveryWithAttempts,
  DeliveryWithContext,
  RecordAttemptInput,
} from './ports/delivery-repository.port';
import type { JobControl } from './ports/job-control.port';
import type { DispatchResult, WebhookDispatcher } from './ports/webhook-dispatcher.port';
import { ProcessDeliveryUseCase } from './process-delivery.use-case';

function makeContext(
  overrides: { delivery?: Partial<Delivery>; subscriber?: Partial<Subscriber> } = {},
): DeliveryWithContext {
  const delivery: Delivery = {
    id: 'del_1',
    eventId: 'evt_1',
    subscriberId: 'sub_1',
    status: 'pending',
    attemptCount: 0,
    nextAttemptAt: null,
    createdAt: new Date(),
    completedAt: null,
    ...overrides.delivery,
  };
  const event: WebhookEvent = {
    id: 'evt_1',
    eventType: 'order.created',
    payload: { orderId: '1' },
    idempotencyKey: 'idem_1',
    payloadHash: 'hash',
    occurredAt: new Date(),
    createdAt: new Date(),
  };
  const subscriber: Subscriber = {
    id: 'sub_1',
    name: 'Test',
    targetUrl: 'https://example.com/hook',
    secretEncrypted: 'enc',
    previousSecretEncrypted: null,
    previousSecretExpiresAt: null,
    eventTypes: ['order.created'],
    isActive: true,
    timeoutMs: 10_000,
    maxRetries: 3,
    rateLimitPerSec: 5,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides.subscriber,
  };
  return { delivery, event, subscriber };
}

class FakeDeliveryRepository implements DeliveryRepository {
  recorded: RecordAttemptInput[] = [];

  constructor(private readonly context: DeliveryWithContext | null) {}

  async findWithContext(): Promise<DeliveryWithContext | null> {
    return this.context;
  }

  async recordAttempt(input: RecordAttemptInput): Promise<void> {
    this.recorded.push(input);
  }

  async listDead(): Promise<{ items: DeliveryWithContext[]; total: number }> {
    return { items: [], total: 0 };
  }

  async resetForRetry(): Promise<boolean> {
    return false;
  }

  async list(): Promise<{ items: DeliveryWithContext[]; total: number }> {
    return { items: [], total: 0 };
  }

  async getWithAttempts(): Promise<DeliveryWithAttempts | null> {
    return null;
  }
}

class FakeDeliveryEventPublisher implements DeliveryEventPublisher {
  published: DeliveryEventPayload[] = [];

  async publish(event: DeliveryEventPayload): Promise<void> {
    this.published.push(event);
  }
}

class FakeJobControl implements JobControl {
  deferredMs: number[] = [];

  async defer(delayMs: number): Promise<void> {
    this.deferredMs.push(delayMs);
  }
}

function successResult(): DispatchResult {
  return {
    requestHeaders: {},
    responseStatus: 200,
    responseBodyTruncated: 'ok',
    latencyMs: 50,
    outcome: { kind: 'success' },
  };
}

describe('ProcessDeliveryUseCase', () => {
  it('does nothing when the delivery no longer exists', async () => {
    const deliveries = new FakeDeliveryRepository(null);
    const dispatcher: WebhookDispatcher = { dispatch: async () => successResult() };
    const useCase = new ProcessDeliveryUseCase(
      deliveries,
      dispatcher,
      new FakeDeliveryEventPublisher(),
    );

    await useCase.execute('missing', new FakeJobControl());

    expect(deliveries.recorded).toHaveLength(0);
  });

  it('does nothing when the delivery is already terminal', async () => {
    const context = makeContext({ delivery: { status: 'succeeded' } });
    const deliveries = new FakeDeliveryRepository(context);
    let dispatchCalled = false;
    const dispatcher: WebhookDispatcher = {
      dispatch: async () => {
        dispatchCalled = true;
        return successResult();
      },
    };
    const useCase = new ProcessDeliveryUseCase(
      deliveries,
      dispatcher,
      new FakeDeliveryEventPublisher(),
    );

    await useCase.execute('del_1', new FakeJobControl());

    expect(dispatchCalled).toBe(false);
  });

  it('marks the delivery dead without dispatching when the subscriber is inactive', async () => {
    const context = makeContext({ subscriber: { isActive: false } });
    const deliveries = new FakeDeliveryRepository(context);
    let dispatchCalled = false;
    const dispatcher: WebhookDispatcher = {
      dispatch: async () => {
        dispatchCalled = true;
        return successResult();
      },
    };
    const useCase = new ProcessDeliveryUseCase(
      deliveries,
      dispatcher,
      new FakeDeliveryEventPublisher(),
    );

    await useCase.execute('del_1', new FakeJobControl());

    expect(dispatchCalled).toBe(false);
    expect(deliveries.recorded[0]?.update).toEqual({ outcome: 'dead' });
  });

  it('marks the delivery succeeded on a 2xx response', async () => {
    const deliveries = new FakeDeliveryRepository(makeContext());
    const dispatcher: WebhookDispatcher = { dispatch: async () => successResult() };
    const useCase = new ProcessDeliveryUseCase(
      deliveries,
      dispatcher,
      new FakeDeliveryEventPublisher(),
    );

    await useCase.execute('del_1', new FakeJobControl());

    expect(deliveries.recorded[0]?.update).toEqual({ outcome: 'succeeded' });
  });

  it('marks the delivery dead immediately on a permanent (4xx) failure', async () => {
    const deliveries = new FakeDeliveryRepository(makeContext());
    const dispatcher: WebhookDispatcher = {
      dispatch: async () => ({
        requestHeaders: {},
        responseStatus: 400,
        responseBodyTruncated: null,
        latencyMs: 10,
        outcome: { kind: 'permanent-failure', reason: 'client error (400)' },
      }),
    };
    const useCase = new ProcessDeliveryUseCase(
      deliveries,
      dispatcher,
      new FakeDeliveryEventPublisher(),
    );

    await useCase.execute('del_1', new FakeJobControl());

    expect(deliveries.recorded[0]?.update).toEqual({ outcome: 'dead' });
  });

  it('throws RetryableDeliveryError and schedules a retry when budget remains', async () => {
    const deliveries = new FakeDeliveryRepository(
      makeContext({ delivery: { attemptCount: 0 }, subscriber: { maxRetries: 3 } }),
    );
    const dispatcher: WebhookDispatcher = {
      dispatch: async () => ({
        requestHeaders: {},
        responseStatus: 503,
        responseBodyTruncated: null,
        latencyMs: 10,
        outcome: { kind: 'retryable-failure', reason: 'server error (503)' },
      }),
    };
    const useCase = new ProcessDeliveryUseCase(
      deliveries,
      dispatcher,
      new FakeDeliveryEventPublisher(),
    );

    await expect(useCase.execute('del_1', new FakeJobControl())).rejects.toThrow(
      RetryableDeliveryError,
    );
    expect(deliveries.recorded[0]?.update.outcome).toBe('retrying');
  });

  it('honors Retry-After for the retry delay instead of full jitter', async () => {
    const deliveries = new FakeDeliveryRepository(makeContext());
    const dispatcher: WebhookDispatcher = {
      dispatch: async () => ({
        requestHeaders: {},
        responseStatus: 429,
        responseBodyTruncated: null,
        latencyMs: 10,
        outcome: { kind: 'retryable-failure', reason: 'rate limited (429)', retryAfterMs: 5000 },
      }),
    };
    const useCase = new ProcessDeliveryUseCase(
      deliveries,
      dispatcher,
      new FakeDeliveryEventPublisher(),
    );

    let caught: unknown;
    try {
      await useCase.execute('del_1', new FakeJobControl());
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(RetryableDeliveryError);
    const delayMs = (caught as RetryableDeliveryError).delayMs;
    expect(delayMs).toBeGreaterThanOrEqual(4900);
    expect(delayMs).toBeLessThanOrEqual(5000);
  });

  it('marks the delivery dead once maxRetries is exhausted, without throwing', async () => {
    // maxRetries=3 allows 4 total attempts (1 initial + 3 retries).
    // attemptCount 3 means this call is attempt #4 — one past the budget.
    const context = makeContext({
      delivery: { attemptCount: 3 },
      subscriber: { maxRetries: 3 },
    });
    const deliveries = new FakeDeliveryRepository(context);
    const dispatcher: WebhookDispatcher = {
      dispatch: async () => ({
        requestHeaders: {},
        responseStatus: 503,
        responseBodyTruncated: null,
        latencyMs: 10,
        outcome: { kind: 'retryable-failure', reason: 'server error (503)' },
      }),
    };
    const useCase = new ProcessDeliveryUseCase(
      deliveries,
      dispatcher,
      new FakeDeliveryEventPublisher(),
    );

    await expect(useCase.execute('del_1', new FakeJobControl())).resolves.toBeUndefined();
    expect(deliveries.recorded[0]?.update).toEqual({ outcome: 'dead' });
  });

  it('still retries on the attempt that exactly matches maxRetries', async () => {
    // maxRetries=3 allows 4 total attempts. attemptCount 2 means this call is
    // attempt #3 — still within budget (attempt #4 should still be allowed).
    const context = makeContext({
      delivery: { attemptCount: 2 },
      subscriber: { maxRetries: 3 },
    });
    const deliveries = new FakeDeliveryRepository(context);
    const dispatcher: WebhookDispatcher = {
      dispatch: async () => ({
        requestHeaders: {},
        responseStatus: 503,
        responseBodyTruncated: null,
        latencyMs: 10,
        outcome: { kind: 'retryable-failure', reason: 'server error (503)' },
      }),
    };
    const useCase = new ProcessDeliveryUseCase(
      deliveries,
      dispatcher,
      new FakeDeliveryEventPublisher(),
    );

    await expect(useCase.execute('del_1', new FakeJobControl())).rejects.toThrow(
      RetryableDeliveryError,
    );
    expect(deliveries.recorded[0]?.update.outcome).toBe('retrying');
  });

  it('defers via jobControl and throws DeferredError without recording an attempt when rate limited or circuit open', async () => {
    const deliveries = new FakeDeliveryRepository(makeContext());
    const dispatcher: WebhookDispatcher = {
      dispatch: async () => ({
        requestHeaders: {},
        responseStatus: null,
        responseBodyTruncated: null,
        latencyMs: 0,
        outcome: { kind: 'deferred', reason: 'rate limited on example.com', retryAfterMs: 2000 },
      }),
    };
    const jobControl = new FakeJobControl();
    const useCase = new ProcessDeliveryUseCase(
      deliveries,
      dispatcher,
      new FakeDeliveryEventPublisher(),
    );

    await expect(useCase.execute('del_1', jobControl)).rejects.toThrow(DeferredError);

    expect(jobControl.deferredMs).toEqual([2000]);
    expect(deliveries.recorded).toHaveLength(0);
  });
});
