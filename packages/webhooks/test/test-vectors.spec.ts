import { describe, expect, it } from 'vitest';

import { sign, verify } from '../src/index';
import vectorsFile from '../test-vectors.json';

describe('test-vectors.json', () => {
  it.each(vectorsFile.vectors)('$name: sign() matches the published vector', (vector) => {
    const result = sign({
      payload: vector.payload,
      secret: vector.secret,
      timestamp: vector.timestamp,
    });
    expect(result.signature).toBe(vector.expectedSignature);
  });

  it.each(vectorsFile.vectors)('$name: verify() accepts the published vector', (vector) => {
    // These timestamps are fixed historical values, not "just now" — widen the
    // tolerance so this only exercises signature correctness, not freshness.
    const ok = verify({
      payload: vector.payload,
      secret: vector.secret,
      signatureHeader: vector.expectedSignature,
      timestampHeader: String(vector.timestamp),
      toleranceSeconds: Number.MAX_SAFE_INTEGER,
    });
    expect(ok).toBe(true);
  });
});
