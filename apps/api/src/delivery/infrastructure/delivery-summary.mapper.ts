import type { DeliveryWithContext } from '../application/ports/delivery-repository.port';

/** Shared response shape for DlqController and DeliveriesController so the dashboard has one type to render either. */
export function toDeliverySummary(item: DeliveryWithContext) {
  return {
    deliveryId: item.delivery.id,
    status: item.delivery.status,
    attemptCount: item.delivery.attemptCount,
    nextAttemptAt: item.delivery.nextAttemptAt,
    createdAt: item.delivery.createdAt,
    completedAt: item.delivery.completedAt,
    event: { id: item.event.id, eventType: item.event.eventType, payload: item.event.payload },
    subscriber: {
      id: item.subscriber.id,
      name: item.subscriber.name,
      targetUrl: item.subscriber.targetUrl,
    },
  };
}
