/** Named `WebhookEvent` (not `Event`) to avoid shadowing the DOM/lib.dom global. */
export interface WebhookEvent {
  readonly id: string;
  readonly eventType: string;
  readonly payload: Record<string, unknown>;
  readonly idempotencyKey: string;
  readonly payloadHash: string;
  readonly occurredAt: Date;
  readonly createdAt: Date;
}

export interface NewWebhookEvent {
  readonly eventType: string;
  readonly payload: Record<string, unknown>;
  readonly idempotencyKey: string;
  readonly payloadHash: string;
}
