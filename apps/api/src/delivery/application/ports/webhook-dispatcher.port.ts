import type { WebhookEvent } from '../../../events/domain/event';
import type { Subscriber } from '../../../subscriptions/domain/subscriber';
import type { DeliveryOutcome } from '../../domain/delivery-outcome';
import type { Delivery } from '../../domain/delivery';

export const WEBHOOK_DISPATCHER = Symbol('WEBHOOK_DISPATCHER');

export interface DispatchContext {
  readonly delivery: Delivery;
  readonly event: WebhookEvent;
  readonly subscriber: Subscriber;
}

export interface DispatchResult {
  readonly requestHeaders: Record<string, string>;
  readonly responseStatus: number | null;
  readonly responseBodyTruncated: string | null;
  readonly latencyMs: number;
  readonly outcome: DeliveryOutcome;
}

/** Never throws — network/timeout failures come back as a retryable DeliveryOutcome. */
export interface WebhookDispatcher {
  dispatch(context: DispatchContext): Promise<DispatchResult>;
}
