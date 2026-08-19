import type { Delivery } from '../../../delivery/domain/delivery';
import type { NewWebhookEvent, WebhookEvent } from '../../domain/event';

export const EVENT_REPOSITORY = Symbol('EVENT_REPOSITORY');

export interface IngestEventResult {
  readonly event: WebhookEvent;
  readonly deliveries: readonly Delivery[];
  /** True when this call returned a previously-ingested event (same Idempotency-Key). */
  readonly alreadyIngested: boolean;
}

export interface EventRepository {
  /**
   * Atomically records the event — or, for a repeated Idempotency-Key with an
   * identical payload, returns the original ingestion — and fans out one
   * pending delivery per given subscriber. Throws IdempotencyConflictError if
   * the key was already used with a different payload.
   */
  ingest(input: NewWebhookEvent, subscriberIds: readonly string[]): Promise<IngestEventResult>;
}
