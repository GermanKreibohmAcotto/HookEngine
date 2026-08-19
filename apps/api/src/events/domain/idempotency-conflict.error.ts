/** Same Idempotency-Key, different payload — a client bug, not something to silently swallow. */
export class IdempotencyConflictError extends Error {
  constructor(readonly idempotencyKey: string) {
    super(`Idempotency-Key "${idempotencyKey}" was already used with a different payload`);
    this.name = 'IdempotencyConflictError';
  }
}
