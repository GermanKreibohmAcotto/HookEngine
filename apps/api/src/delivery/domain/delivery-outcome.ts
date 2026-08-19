export type DeliveryOutcome =
  | { readonly kind: 'success' }
  | { readonly kind: 'permanent-failure'; readonly reason: string }
  | {
      readonly kind: 'retryable-failure';
      readonly reason: string;
      readonly retryAfterMs?: number | undefined;
    }
  /** No HTTP call was made at all — rate limited or circuit open. Never recorded as an attempt. */
  | { readonly kind: 'deferred'; readonly reason: string; readonly retryAfterMs: number };

export function parseRetryAfterMs(header: string | undefined): number | undefined {
  if (!header) {
    return undefined;
  }

  const seconds = Number(header);
  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1000);
  }

  const dateMs = Date.parse(header);
  if (!Number.isNaN(dateMs)) {
    return Math.max(0, dateMs - Date.now());
  }

  return undefined;
}

/**
 * 2xx succeeds. 4xx (other than 408/429) is permanent — the subscriber is
 * telling us our request is wrong in a way retrying won't fix. 408, 429, and
 * 5xx are all retryable; 429 additionally honors Retry-After if present.
 */
export function classifyResponse(statusCode: number, retryAfterHeader?: string): DeliveryOutcome {
  if (statusCode >= 200 && statusCode < 300) {
    return { kind: 'success' };
  }
  if (statusCode === 429) {
    return {
      kind: 'retryable-failure',
      reason: 'rate limited (429)',
      retryAfterMs: parseRetryAfterMs(retryAfterHeader),
    };
  }
  if (statusCode === 408) {
    return { kind: 'retryable-failure', reason: 'request timeout (408)' };
  }
  if (statusCode >= 400 && statusCode < 500) {
    return { kind: 'permanent-failure', reason: `client error (${statusCode})` };
  }
  return { kind: 'retryable-failure', reason: `server error (${statusCode})` };
}

export function classifyNetworkError(error: unknown): DeliveryOutcome {
  const reason = error instanceof Error ? error.message : String(error);
  return { kind: 'retryable-failure', reason: `network error: ${reason}` };
}
