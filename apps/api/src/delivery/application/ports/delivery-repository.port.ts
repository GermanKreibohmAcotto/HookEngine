import type { WebhookEvent } from '../../../events/domain/event';
import type { Subscriber } from '../../../subscriptions/domain/subscriber';
import type { DeliveryAttempt } from '../../domain/delivery-attempt';
import type { Delivery, DeliveryStatus } from '../../domain/delivery';

export const DELIVERY_REPOSITORY = Symbol('DELIVERY_REPOSITORY');

export interface DeliveryWithContext {
  readonly delivery: Delivery;
  readonly event: WebhookEvent;
  readonly subscriber: Subscriber;
}

export type DeliveryAttemptUpdate =
  | { readonly outcome: 'succeeded' }
  | { readonly outcome: 'retrying'; readonly nextAttemptAt: Date }
  | { readonly outcome: 'dead' };

export interface RecordAttemptInput {
  readonly deliveryId: string;
  readonly attemptNumber: number;
  readonly requestHeaders: Record<string, string>;
  readonly responseStatus: number | null;
  readonly responseBodyTruncated: string | null;
  readonly latencyMs: number | null;
  readonly errorMessage: string | null;
  readonly update: DeliveryAttemptUpdate;
}

export interface Pagination {
  readonly limit: number;
  readonly offset: number;
}

export interface DeliveryPage {
  readonly items: readonly DeliveryWithContext[];
  readonly total: number;
}

export interface DeliveryFilter {
  readonly status?: DeliveryStatus | undefined;
  readonly subscriberId?: string | undefined;
}

export interface DeliveryWithAttempts extends DeliveryWithContext {
  readonly attempts: readonly DeliveryAttempt[];
}

export interface DeliveryRepository {
  findWithContext(deliveryId: string): Promise<DeliveryWithContext | null>;
  /** Atomically logs the attempt and applies the resulting delivery status change. */
  recordAttempt(input: RecordAttemptInput): Promise<void>;
  listDead(pagination: Pagination): Promise<DeliveryPage>;
  /** Resets a dead delivery back to pending. Returns false if it wasn't found in the 'dead' state. */
  resetForRetry(deliveryId: string): Promise<boolean>;
  list(filter: DeliveryFilter, pagination: Pagination): Promise<DeliveryPage>;
  getWithAttempts(deliveryId: string): Promise<DeliveryWithAttempts | null>;
}
