/**
 * Thrown by ProcessDeliveryUseCase to trigger a BullMQ retry. Carries the
 * intended delay so the Worker's backoffStrategy can honor a subscriber's
 * Retry-After header instead of always falling back to full-jitter backoff.
 */
export class RetryableDeliveryError extends Error {
  constructor(
    message: string,
    readonly delayMs?: number,
  ) {
    super(message);
    this.name = 'RetryableDeliveryError';
  }
}
