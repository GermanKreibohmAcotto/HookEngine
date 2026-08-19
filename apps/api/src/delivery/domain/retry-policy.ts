export interface RetryPolicyOptions {
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
}

export const DEFAULT_RETRY_POLICY: RetryPolicyOptions = {
  baseDelayMs: 1_000,
  maxDelayMs: 5 * 60_000,
};

/**
 * Full jitter (AWS's formula): random(0, min(maxDelay, base * 2^attempt)).
 * A deterministic exponential backoff would make every delivery that failed
 * because a subscriber went down retry at the *same instant* it comes back
 * up — recreating the outage that just recovered. Full jitter spreads that
 * retry storm across the whole window instead.
 */
export function computeBackoffDelayMs(
  attemptsMade: number,
  policy: RetryPolicyOptions = DEFAULT_RETRY_POLICY,
): number {
  const exponential = Math.min(policy.maxDelayMs, policy.baseDelayMs * 2 ** attemptsMade);
  return Math.floor(Math.random() * exponential);
}
