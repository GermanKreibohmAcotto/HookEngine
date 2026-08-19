import { describe, expect, it } from 'vitest';

import type { WebhookEvent } from '../../events/domain/event';
import type { Subscriber } from '../../subscriptions/domain/subscriber';
import type {
  DispatchContext,
  DispatchResult,
  WebhookDispatcher,
} from '../application/ports/webhook-dispatcher.port';
import type { Delivery } from '../domain/delivery';
import { RateLimitedDispatcher } from './rate-limited-dispatcher.decorator';
import type { RateLimitResult, TokenBucketRateLimiter } from './token-bucket-rate-limiter';

function makeContext(rateLimitPerSec = 5): DispatchContext {
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
    rateLimitPerSec,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  return { delivery, event, subscriber };
}

function fakeRateLimiter(result: RateLimitResult): TokenBucketRateLimiter {
  return { consume: async () => result } as unknown as TokenBucketRateLimiter;
}

describe('RateLimitedDispatcher', () => {
  it('passes through to the inner dispatcher when a token is available', async () => {
    let innerCalled = false;
    const inner: WebhookDispatcher = {
      dispatch: async (): Promise<DispatchResult> => {
        innerCalled = true;
        return {
          requestHeaders: {},
          responseStatus: 200,
          responseBodyTruncated: null,
          latencyMs: 50,
          outcome: { kind: 'success' },
        };
      },
    };
    const decorator = new RateLimitedDispatcher(
      inner,
      fakeRateLimiter({ allowed: true, retryAfterMs: 0 }),
    );

    const result = await decorator.dispatch(makeContext());

    expect(innerCalled).toBe(true);
    expect(result.outcome.kind).toBe('success');
  });

  it('returns a deferred outcome without calling the inner dispatcher when no token is available', async () => {
    let innerCalled = false;
    const inner: WebhookDispatcher = {
      dispatch: async (): Promise<DispatchResult> => {
        innerCalled = true;
        throw new Error('should not be called');
      },
    };
    const decorator = new RateLimitedDispatcher(
      inner,
      fakeRateLimiter({ allowed: false, retryAfterMs: 1500 }),
    );

    const result = await decorator.dispatch(makeContext());

    expect(innerCalled).toBe(false);
    expect(result.outcome).toEqual({
      kind: 'deferred',
      reason: 'rate limited on api.example.com',
      retryAfterMs: 1500,
    });
  });
});
