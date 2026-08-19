import { describe, expect, it } from 'vitest';

import { hashPayload } from './payload-hash';

describe('hashPayload', () => {
  it('is stable for identical payloads', () => {
    const payload = { orderId: 'ord_123', total: 42 };
    expect(hashPayload(payload)).toBe(hashPayload({ ...payload }));
  });

  it('is independent of key order', () => {
    const a = { orderId: 'ord_123', total: 42 };
    const b = { total: 42, orderId: 'ord_123' };
    expect(hashPayload(a)).toBe(hashPayload(b));
  });

  it('is independent of nested key order', () => {
    const a = { order: { id: 'ord_123', total: 42 } };
    const b = { order: { total: 42, id: 'ord_123' } };
    expect(hashPayload(a)).toBe(hashPayload(b));
  });

  it('changes when a value changes', () => {
    expect(hashPayload({ total: 42 })).not.toBe(hashPayload({ total: 43 }));
  });

  it('preserves array order (arrays are not sorted)', () => {
    const a = { items: ['a', 'b'] };
    const b = { items: ['b', 'a'] };
    expect(hashPayload(a)).not.toBe(hashPayload(b));
  });
});
