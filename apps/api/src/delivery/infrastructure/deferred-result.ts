import type { DispatchResult } from '../application/ports/webhook-dispatcher.port';

/** No HTTP call was made — rate limited or circuit open. */
export function deferredResult(reason: string, retryAfterMs: number): DispatchResult {
  return {
    requestHeaders: {},
    responseStatus: null,
    responseBodyTruncated: null,
    latencyMs: 0,
    outcome: { kind: 'deferred', reason, retryAfterMs },
  };
}
