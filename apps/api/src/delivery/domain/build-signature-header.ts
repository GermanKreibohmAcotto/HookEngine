import { sign } from '@hookengine/webhooks';

import type { Subscriber } from '../../subscriptions/domain/subscriber';
import { decryptSecret } from '../../subscriptions/domain/webhook-secret';

export interface SignatureHeader {
  readonly timestamp: number;
  /** One `v1=<hex>` entry, or two comma-separated during a secret rotation grace period. */
  readonly signatureHeader: string;
}

/**
 * Signs with the current secret, and — while a rotation grace period is
 * still active — with the previous one too, joined into a single
 * comma-separated header. See docs/SIGNATURE_SPEC.md "Secret rotation".
 */
export function buildSignatureHeader(
  body: string,
  subscriber: Subscriber,
  encryptionKey: Buffer,
): SignatureHeader {
  const currentSecret = decryptSecret(subscriber.secretEncrypted, encryptionKey);
  const { timestamp, signature: currentSignature } = sign({ payload: body, secret: currentSecret });

  const hasActivePreviousSecret =
    subscriber.previousSecretEncrypted !== null &&
    subscriber.previousSecretExpiresAt !== null &&
    subscriber.previousSecretExpiresAt.getTime() > Date.now();

  if (!hasActivePreviousSecret || subscriber.previousSecretEncrypted === null) {
    return { timestamp, signatureHeader: currentSignature };
  }

  const previousSecret = decryptSecret(subscriber.previousSecretEncrypted, encryptionKey);
  const { signature: previousSignature } = sign({
    payload: body,
    secret: previousSecret,
    timestamp,
  });

  return { timestamp, signatureHeader: `${currentSignature}, ${previousSignature}` };
}
