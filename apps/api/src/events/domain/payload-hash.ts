import { createHash } from 'node:crypto';

/**
 * Sorts object keys recursively so two payloads that are semantically equal
 * but arrived with keys in a different order still hash the same — otherwise
 * the idempotency check would reject a retried request over nothing but JSON
 * key ordering.
 */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value !== null && typeof value === 'object') {
    const sortedEntries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => [key, canonicalize(val)] as const);
    return Object.fromEntries(sortedEntries);
  }
  return value;
}

export function hashPayload(payload: Record<string, unknown>): string {
  const canonical = JSON.stringify(canonicalize(payload));
  return createHash('sha256').update(canonical).digest('hex');
}
