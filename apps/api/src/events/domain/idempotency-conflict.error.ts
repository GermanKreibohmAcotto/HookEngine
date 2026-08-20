import type { ErrorCode } from '../../shared/http/error-codes';

/** Same Idempotency-Key, different payload — a client bug, not something to silently swallow. */
export class IdempotencyConflictError extends Error {
  readonly code: ErrorCode = 'IDEMPOTENCY_CONFLICT';

  constructor(readonly idempotencyKey: string) {
    super(`Idempotency-Key "${idempotencyKey}" was already used with a different payload`);
    this.name = 'IdempotencyConflictError';
  }

  get details(): Record<string, unknown> {
    return { idempotencyKey: this.idempotencyKey };
  }
}
