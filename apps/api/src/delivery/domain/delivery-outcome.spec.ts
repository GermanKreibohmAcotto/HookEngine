import { describe, expect, it } from 'vitest';

import { classifyNetworkError, classifyResponse, parseRetryAfterMs } from './delivery-outcome';

describe('classifyResponse', () => {
  it.each([200, 201, 204, 299])('treats %i as success', (status) => {
    expect(classifyResponse(status)).toEqual({ kind: 'success' });
  });

  it.each([400, 401, 403, 404, 422])('treats %i as a permanent failure', (status) => {
    expect(classifyResponse(status).kind).toBe('permanent-failure');
  });

  it('treats 408 as retryable', () => {
    expect(classifyResponse(408).kind).toBe('retryable-failure');
  });

  it('treats 429 as retryable and carries Retry-After', () => {
    const outcome = classifyResponse(429, '2');
    expect(outcome.kind).toBe('retryable-failure');
    if (outcome.kind === 'retryable-failure') {
      expect(outcome.retryAfterMs).toBe(2000);
    }
  });

  it.each([500, 502, 503])('treats %i as retryable', (status) => {
    expect(classifyResponse(status).kind).toBe('retryable-failure');
  });
});

describe('classifyNetworkError', () => {
  it('is always retryable and includes the error message', () => {
    const outcome = classifyNetworkError(new Error('ECONNREFUSED'));
    expect(outcome.kind).toBe('retryable-failure');
    if (outcome.kind === 'retryable-failure') {
      expect(outcome.reason).toContain('ECONNREFUSED');
    }
  });
});

describe('parseRetryAfterMs', () => {
  it('parses a delay in seconds', () => {
    expect(parseRetryAfterMs('5')).toBe(5000);
  });

  it('parses an HTTP date', () => {
    const future = new Date(Date.now() + 10_000).toUTCString();
    const ms = parseRetryAfterMs(future);
    expect(ms).toBeGreaterThan(5000);
    expect(ms).toBeLessThanOrEqual(10_000);
  });

  it('returns undefined for a garbage value', () => {
    expect(parseRetryAfterMs('not-a-value')).toBeUndefined();
  });

  it('returns undefined when absent', () => {
    expect(parseRetryAfterMs(undefined)).toBeUndefined();
  });
});
