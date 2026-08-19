export const DELIVERY_QUEUE = Symbol('DELIVERY_QUEUE');

export interface DeliveryQueue {
  enqueue(deliveryId: string): Promise<void>;
  /** Re-enqueues a delivery for a fresh attempt, e.g. after a manual DLQ retry. */
  retry(deliveryId: string): Promise<void>;
}
