import type { DeliveryStatus } from '../../domain/delivery';

export const DELIVERY_EVENT_PUBLISHER = Symbol('DELIVERY_EVENT_PUBLISHER');

export interface DeliveryEventPayload {
  readonly deliveryId: string;
  readonly subscriberId: string;
  readonly subscriberName: string;
  readonly eventType: string;
  readonly status: DeliveryStatus;
  readonly attemptNumber: number;
  readonly responseStatus: number | null;
  readonly latencyMs: number | null;
  readonly attemptedAt: string;
}

/** Fan-out for the live dashboard stream — never on the critical delivery path, so failures are swallowed by the caller. */
export interface DeliveryEventPublisher {
  publish(event: DeliveryEventPayload): Promise<void>;
}
