import { Inject, Injectable } from '@nestjs/common';

import type {
  DispatchContext,
  DispatchResult,
  WebhookDispatcher,
} from '../application/ports/webhook-dispatcher.port';
import { deferredResult } from './deferred-result';
import { RAW_WEBHOOK_DISPATCHER } from './dispatcher-tokens';
import { TokenBucketRateLimiter } from './token-bucket-rate-limiter';

const MIN_BURST_CAPACITY = 1;

/**
 * Decorates a WebhookDispatcher with a per-domain token bucket. Delivery
 * logic itself lives entirely in the wrapped dispatcher — this only ever
 * decides "not yet" and hands off untouched otherwise.
 */
@Injectable()
export class RateLimitedDispatcher implements WebhookDispatcher {
  constructor(
    @Inject(RAW_WEBHOOK_DISPATCHER) private readonly inner: WebhookDispatcher,
    private readonly rateLimiter: TokenBucketRateLimiter,
  ) {}

  async dispatch(context: DispatchContext): Promise<DispatchResult> {
    const domain = new URL(context.subscriber.targetUrl).hostname;
    const capacity = Math.max(MIN_BURST_CAPACITY, context.subscriber.rateLimitPerSec);

    const { allowed, retryAfterMs } = await this.rateLimiter.consume(
      domain,
      context.subscriber.rateLimitPerSec,
      capacity,
    );

    if (!allowed) {
      return deferredResult(`rate limited on ${domain}`, retryAfterMs);
    }

    return this.inner.dispatch(context);
  }
}
