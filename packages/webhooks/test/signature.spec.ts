import { describe, expect, it } from 'vitest';

import { sign, verify } from '../src/index';

describe('sign', () => {
  it('produces a v1-prefixed 64-char hex signature', () => {
    const { signature } = sign({ payload: '{"a":1}', secret: 'shh', timestamp: 1_700_000_000 });
    expect(signature).toMatch(/^v1=[0-9a-f]{64}$/);
  });

  it('is deterministic for identical inputs', () => {
    const a = sign({ payload: '{"a":1}', secret: 'shh', timestamp: 1_700_000_000 });
    const b = sign({ payload: '{"a":1}', secret: 'shh', timestamp: 1_700_000_000 });
    expect(a.signature).toBe(b.signature);
  });

  it('changes when the payload, secret, or timestamp changes', () => {
    const base = sign({ payload: '{"a":1}', secret: 'shh', timestamp: 1_700_000_000 });
    expect(
      sign({ payload: '{"a":2}', secret: 'shh', timestamp: 1_700_000_000 }).signature,
    ).not.toBe(base.signature);
    expect(
      sign({ payload: '{"a":1}', secret: 'other', timestamp: 1_700_000_000 }).signature,
    ).not.toBe(base.signature);
    expect(
      sign({ payload: '{"a":1}', secret: 'shh', timestamp: 1_700_000_001 }).signature,
    ).not.toBe(base.signature);
  });

  it('defaults the timestamp to now', () => {
    const before = Math.floor(Date.now() / 1000);
    const { timestamp } = sign({ payload: '{}', secret: 'shh' });
    expect(timestamp).toBeGreaterThanOrEqual(before);
  });
});

describe('verify', () => {
  const secret = 'whsec_test';
  const payload = '{"orderId":"123"}';

  it('accepts a signature it just produced', () => {
    const { timestamp, signature } = sign({ payload, secret });
    const ok = verify({
      payload,
      secret,
      signatureHeader: signature,
      timestampHeader: String(timestamp),
    });
    expect(ok).toBe(true);
  });

  it('rejects a signature from the wrong secret', () => {
    const { timestamp, signature } = sign({ payload, secret });
    const ok = verify({
      payload,
      secret: 'wrong-secret',
      signatureHeader: signature,
      timestampHeader: String(timestamp),
    });
    expect(ok).toBe(false);
  });

  it('rejects a tampered payload', () => {
    const { timestamp, signature } = sign({ payload, secret });
    const ok = verify({
      payload: payload.replace('123', '999'),
      secret,
      signatureHeader: signature,
      timestampHeader: String(timestamp),
    });
    expect(ok).toBe(false);
  });

  it('rejects a signature outside the tolerance window', () => {
    const staleTimestamp = Math.floor(Date.now() / 1000) - 600;
    const { signature } = sign({ payload, secret, timestamp: staleTimestamp });
    const ok = verify({
      payload,
      secret,
      signatureHeader: signature,
      timestampHeader: String(staleTimestamp),
    });
    expect(ok).toBe(false);
  });

  it('accepts a stale signature when tolerance is widened', () => {
    const staleTimestamp = Math.floor(Date.now() / 1000) - 600;
    const { signature } = sign({ payload, secret, timestamp: staleTimestamp });
    const ok = verify({
      payload,
      secret,
      signatureHeader: signature,
      timestampHeader: String(staleTimestamp),
      toleranceSeconds: 3600,
    });
    expect(ok).toBe(true);
  });

  it('rejects a signature missing the v1= prefix', () => {
    const { timestamp, signature } = sign({ payload, secret });
    const ok = verify({
      payload,
      secret,
      signatureHeader: signature.replace('v1=', ''),
      timestampHeader: String(timestamp),
    });
    expect(ok).toBe(false);
  });

  it('rejects a non-numeric timestamp header', () => {
    const ok = verify({
      payload,
      secret,
      signatureHeader: 'v1=deadbeef',
      timestampHeader: 'not-a-number',
    });
    expect(ok).toBe(false);
  });

  it('rejects garbage hex without throwing', () => {
    const ok = verify({
      payload,
      secret,
      signatureHeader: 'v1=not-hex-at-all!!',
      timestampHeader: String(Math.floor(Date.now() / 1000)),
    });
    expect(ok).toBe(false);
  });

  it('accepts a comma-separated header when any signature matches (secret rotation)', () => {
    const { timestamp, signature } = sign({ payload, secret });
    const decoyFromAnotherSecret = sign({ payload, secret: 'not-the-secret', timestamp }).signature;

    const ok = verify({
      payload,
      secret,
      signatureHeader: `${decoyFromAnotherSecret}, ${signature}`,
      timestampHeader: String(timestamp),
    });
    expect(ok).toBe(true);
  });

  it('rejects a comma-separated header when none of the signatures match', () => {
    const { timestamp } = sign({ payload, secret });
    const wrongA = sign({ payload, secret: 'wrong-a', timestamp }).signature;
    const wrongB = sign({ payload, secret: 'wrong-b', timestamp }).signature;

    const ok = verify({
      payload,
      secret,
      signatureHeader: `${wrongA},${wrongB}`,
      timestampHeader: String(timestamp),
    });
    expect(ok).toBe(false);
  });
});
