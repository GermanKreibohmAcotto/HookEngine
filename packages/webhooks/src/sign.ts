import { createHmac } from 'node:crypto';

export interface SignParams {
  /** The exact raw body bytes that will be sent — sign the string you're actually going to transmit. */
  readonly payload: string;
  readonly secret: string;
  /** Unix seconds. Defaults to now; pass explicitly for reproducible signing (e.g. tests). */
  readonly timestamp?: number;
}

export interface SignResult {
  readonly timestamp: number;
  /** `v1=<hex hmac-sha256>` — see docs/SIGNATURE_SPEC.md. */
  readonly signature: string;
}

export function sign(params: SignParams): SignResult {
  const timestamp = params.timestamp ?? Math.floor(Date.now() / 1000);
  const signedContent = `${timestamp}.${params.payload}`;
  const digest = createHmac('sha256', params.secret).update(signedContent).digest('hex');
  return { timestamp, signature: `v1=${digest}` };
}
