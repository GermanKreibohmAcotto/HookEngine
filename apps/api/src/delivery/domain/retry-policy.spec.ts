import { describe, expect, it, vi } from 'vitest';

import { computeBackoffDelayMs, DEFAULT_RETRY_POLICY } from './retry-policy';

describe('computeBackoffDelayMs', () => {
  it('stays within [0, maxDelayMs]', () => {
    for (let attempt = 0; attempt < 20; attempt++) {
      const delay = computeBackoffDelayMs(attempt);
      expect(delay).toBeGreaterThanOrEqual(0);
      expect(delay).toBeLessThanOrEqual(DEFAULT_RETRY_POLICY.maxDelayMs);
    }
  });

  it('grows exponentially with the attempt count', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(1);
    try {
      expect(computeBackoffDelayMs(0)).toBe(1000);
      expect(computeBackoffDelayMs(1)).toBe(2000);
      expect(computeBackoffDelayMs(2)).toBe(4000);
      expect(computeBackoffDelayMs(3)).toBe(8000);
    } finally {
      spy.mockRestore();
    }
  });

  it('caps at maxDelayMs once the exponential would exceed it', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(1);
    try {
      expect(computeBackoffDelayMs(20)).toBe(DEFAULT_RETRY_POLICY.maxDelayMs);
    } finally {
      spy.mockRestore();
    }
  });

  it('jitters — repeated calls for the same attempt are not all identical', () => {
    const delays = new Set(Array.from({ length: 25 }, () => computeBackoffDelayMs(5)));
    expect(delays.size).toBeGreaterThan(1);
  });
});
