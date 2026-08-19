import { Inject, Injectable } from '@nestjs/common';

import type {
  DispatchContext,
  DispatchResult,
  WebhookDispatcher,
} from '../application/ports/webhook-dispatcher.port';
import { CircuitBreakerService } from './circuit-breaker.service';
import { deferredResult } from './deferred-result';
import { RATE_LIMITED_WEBHOOK_DISPATCHER } from './dispatcher-tokens';

/**
 * Outermost decorator in the chain — checked before the rate limiter, so an
 * open circuit doesn't also spend a rate-limit token on a call we're not
 * going to make. Wraps RateLimitedDispatcher, which wraps the real dispatcher.
 */
@Injectable()
export class CircuitBreakingDispatcher implements WebhookDispatcher {
  constructor(
    @Inject(RATE_LIMITED_WEBHOOK_DISPATCHER) private readonly inner: WebhookDispatcher,
    private readonly circuitBreaker: CircuitBreakerService,
  ) {}

  async dispatch(context: DispatchContext): Promise<DispatchResult> {
    const subscriberId = context.subscriber.id;
    const check = await this.circuitBreaker.check(subscriberId);

    if (!check.allowed) {
      return deferredResult(`circuit open for subscriber ${subscriberId}`, check.retryAfterMs);
    }

    const result = await this.inner.dispatch(context);

    if (result.outcome.kind === 'success') {
      await this.circuitBreaker.reportSuccess(subscriberId);
    } else if (countsAsCircuitFailure(result)) {
      await this.circuitBreaker.reportFailure(subscriberId);
    }
    // Permanent (4xx) failures and 429s don't count against the subscriber's
    // circuit — those mean our request was wrong or they asked us to slow
    // down, neither of which says their service is unhealthy.

    return result;
  }
}

function countsAsCircuitFailure(result: DispatchResult): boolean {
  return result.outcome.kind === 'retryable-failure' && result.responseStatus !== 429;
}
