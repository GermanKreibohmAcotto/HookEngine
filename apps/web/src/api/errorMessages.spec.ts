import { describe, expect, it } from 'vitest';

import { translateApiError, type ErrorCode } from './errorMessages';

const ALL_CODES: ErrorCode[] = [
  'VALIDATION_FAILED',
  'SUBSCRIBER_NOT_FOUND',
  'DELIVERY_NOT_FOUND',
  'DEAD_DELIVERY_NOT_FOUND',
  'IDEMPOTENCY_KEY_REQUIRED',
  'IDEMPOTENCY_CONFLICT',
  'AUTH_HEADER_MISSING',
  'AUTH_KEY_INVALID',
  'TARGET_URL_INVALID',
  'TARGET_URL_UNSUPPORTED_PROTOCOL',
  'TARGET_URL_LOCALHOST',
  'TARGET_URL_PRIVATE_ADDRESS',
  'TARGET_URL_DNS_FAILED',
  'TARGET_URL_RESOLVES_PRIVATE',
];

describe('translateApiError', () => {
  it.each(ALL_CODES)('has a non-empty Spanish message for %s', (code) => {
    const message = translateApiError(400, code, undefined);
    expect(message.length).toBeGreaterThan(0);
  });

  it('interpolates details into the message', () => {
    const message = translateApiError(400, 'TARGET_URL_DNS_FAILED', { hostname: 'no-existe.com' });
    expect(message).toContain('no-existe.com');
  });

  it('falls back to a status-based message for an unrecognized code', () => {
    expect(translateApiError(404, undefined, undefined)).toBe('No se encontró el recurso.');
    expect(translateApiError(418, 'SOME_UNKNOWN_CODE', undefined)).toBe(
      'Ocurrió un error inesperado (418).',
    );
  });
});
