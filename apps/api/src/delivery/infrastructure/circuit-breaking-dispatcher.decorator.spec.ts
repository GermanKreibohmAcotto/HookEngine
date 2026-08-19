import { describe, expect, it } from 'vitest';

import type { WebhookEvent } from '../../events/domain/event';
import type { Subscriber } from '../../subscriptions/domain/subscriber';
import type {
  DispatchContext,
  DispatchResult,
  WebhookDispatcher,
} from '../application/ports/webhook-dispatcher.port';
import type { Delivery } from '../domain/delivery';
import type { CircuitBreakerService, CircuitCheckResult } from './circuit-breaker.service';
import { CircuitBreakingDispatcher } from './circuit-breaking-dispatcher.decorator';

function makeContext(): DispatchContext {
  const delivery: Delivery = {
    id: 'del_1',
    eventId: 'evt_1',
    subscriberId: 'sub_1',
    status: 'pending',
    attemptCount: 0,
    nextAttemptAt: null,
    createdAt: new Date(),
    completedAt: null,
  };
  const event: WebhookEvent = {
    id: 'evt_1',
    eventType: 'order.created',
    payload: {},
    idempotencyKey: 'idem_1',
    payloadHash: 'hash',
    occurredAt: new Date(),
    createdAt: new Date(),
  };
  const subscriber: Subscriber = {
    id: 'sub_1',
    name: 'Test',
    targetUrl: 'https://api.example.com/hook',
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
  };
  return { delivery, event, subscriber };
}

class FakeCircuitBreaker {
  successes: string[] = [];
  failures: string[] = [];

  constructor(private readonly checkResult: CircuitCheckResult) {}

  async check(): Promise<CircuitCheckResult> {
    return this.checkResult;
  }

  async reportSuccess(subscriberId: string): Promise<void> {
    this.successes.push(subscriberId);
  }

  async reportFailure(subscriberId: string): Promise<void> {
    this.failures.push(subscriberId);
  }
}

function resultWith(
  outcome: DispatchResult['outcome'],
  responseStatus: number | null = null,
): DispatchResult {
  return {
    requestHeaders: {},
    responseStatus,
    responseBodyTruncated: null,
    latencyMs: 10,
    outcome,
  };
}

describe('CircuitBreakingDispatcher', () => {
  it('passes through and reports success when the circuit is closed and the call succeeds', async () => {
    const breaker = new FakeCircuitBreaker({ allowed: true });
    const inner: WebhookDispatcher = {
      dispatch: async () => resultWith({ kind: 'success' }, 200),
    };
    const decorator = new CircuitBreakingDispatcher(
      inner,
      breaker as unknown as CircuitBreakerService,
    );

    const result = await decorator.dispatch(makeContext());

    expect(result.outcome.kind).toBe('success');
    expect(breaker.successes).toEqual(['sub_1']);
    expect(breaker.failures).toEqual([]);
  });

  it('returns a deferred outcome without calling the inner dispatcher when the circuit is open', async () => {
    const breaker = new FakeCircuitBreaker({ allowed: false, retryAfterMs: 12_000 });
    let innerCalled = false;
    const inner: WebhookDispatcher = {
      dispatch: async () => {
        innerCalled = true;
        throw new Error('should not be called');
      },
    };
    const decorator = new CircuitBreakingDispatcher(
      inner,
      breaker as unknown as CircuitBreakerService,
    );

    const result = await decorator.dispatch(makeContext());

    expect(innerCalled).toBe(false);
    expect(result.outcome).toEqual({
      kind: 'deferred',
      reason: 'circuit open for subscriber sub_1',
      retryAfterMs: 12_000,
    });
  });

  it('reports a failure for a 5xx retryable outcome', async () => {
    const breaker = new FakeCircuitBreaker({ allowed: true });
    const inner: WebhookDispatcher = {
      dispatch: async () =>
        resultWith({ kind: 'retryable-failure', reason: 'server error (503)' }, 503),
    };
    const decorator = new CircuitBreakingDispatcher(
      inner,
      breaker as unknown as CircuitBreakerService,
    );

    await decorator.dispatch(makeContext());

    expect(breaker.failures).toEqual(['sub_1']);
  });

  it('does not report a failure for a permanent 4xx outcome', async () => {
    const breaker = new FakeCircuitBreaker({ allowed: true });
    const inner: WebhookDispatcher = {
      dispatch: async () =>
        resultWith({ kind: 'permanent-failure', reason: 'client error (400)' }, 400),
    };
    const decorator = new CircuitBreakingDispatcher(
      inner,
      breaker as unknown as CircuitBreakerService,
    );

    await decorator.dispatch(makeContext());

    expect(breaker.failures).toEqual([]);
    expect(breaker.successes).toEqual([]);
  });

  it('does not report a failure for a 429 (explicit backpressure, not a fault)', async () => {
    const breaker = new FakeCircuitBreaker({ allowed: true });
    const inner: WebhookDispatcher = {
      dispatch: async () =>
        resultWith({ kind: 'retryable-failure', reason: 'rate limited (429)' }, 429),
    };
    const decorator = new CircuitBreakingDispatcher(
      inner,
      breaker as unknown as CircuitBreakerService,
    );

    await decorator.dispatch(makeContext());

    expect(breaker.failures).toEqual([]);
  });
});
