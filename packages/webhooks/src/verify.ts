import { createHmac, timingSafeEqual } from 'node:crypto';

export interface VerifyParams {
  /** The exact raw body bytes received — not a re-serialized JSON.stringify of a parsed object. */
  readonly payload: string;
  readonly secret: string;
  /**
   * One `v1=<hex>` signature, or several comma-separated (sent during a
   * secret rotation grace period, one per active secret) — valid if any of
   * them matches.
   */
  readonly signatureHeader: string;
  readonly timestampHeader: string;
  /** Reject signatures older/newer than this many seconds. Default 300 (5 minutes). */
  readonly toleranceSeconds?: number;
}

const DEFAULT_TOLERANCE_SECONDS = 300;
const SIGNATURE_PREFIX = 'v1=';

/**
 * Returns whether the signature is valid and within the timestamp tolerance.
 * Never throws — malformed input just fails verification.
 */
export function verify(params: VerifyParams): boolean {
  const timestamp = Number(params.timestampHeader);
  if (!Number.isFinite(timestamp)) {
    return false;
  }

  const tolerance = params.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - timestamp) > tolerance) {
    return false;
  }

  const signedContent = `${timestamp}.${params.payload}`;
  const expected = createHmac('sha256', params.secret).update(signedContent).digest('hex');

  return params.signatureHeader
    .split(',')
    .map((candidate) => candidate.trim())
    .some((candidate) => {
      if (!candidate.startsWith(SIGNATURE_PREFIX)) {
        return false;
      }
      return timingSafeEqualHex(candidate.slice(SIGNATURE_PREFIX.length), expected);
    });
}

function timingSafeEqualHex(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, 'hex');
  const bufferB = Buffer.from(b, 'hex');
  // Buffer.from(x, 'hex') silently truncates at the first invalid character
  // instead of throwing, so a garbage header just produces a short buffer —
  // still run a dummy comparison so the length check itself isn't a timing tell.
  if (bufferA.length !== bufferB.length) {
    timingSafeEqual(bufferB, bufferB);
    return false;
  }
  return timingSafeEqual(bufferA, bufferB);
}
