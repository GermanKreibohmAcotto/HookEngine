/**
 * Signals that a delivery was deferred (rate limited or circuit open) rather
 * than actually attempted. DeliveryProcessor catches this and reschedules the
 * BullMQ job via moveToDelayed() instead of letting it count as a failed
 * attempt — the whole point is that the subscriber's retry budget shouldn't
 * shrink for a call we never made.
 */
export class DeferredError extends Error {
  constructor(
    message: string,
    readonly delayMs: number,
  ) {
    super(message);
    this.name = 'DeferredError';
  }
}
