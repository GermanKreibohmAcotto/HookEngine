import { verify } from '@hookengine/webhooks';
import { describe, expect, it } from 'vitest';

import type { Subscriber } from '../../subscriptions/domain/subscriber';
import { encryptSecret, parseEncryptionKey } from '../../subscriptions/domain/webhook-secret';
import { buildSignatureHeader } from './build-signature-header';

const key = parseEncryptionKey('00'.repeat(32));

function makeSubscriber(overrides: Partial<Subscriber> = {}): Subscriber {
  return {
    id: 'sub_1',
    name: 'Test',
    targetUrl: 'https://example.com/hook',
    secretEncrypted: encryptSecret('current-secret', key),
    previousSecretEncrypted: null,
    previousSecretExpiresAt: null,
    eventTypes: ['order.created'],
    isActive: true,
    timeoutMs: 10_000,
    maxRetries: 8,
    rateLimitPerSec: 5,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('buildSignatureHeader', () => {
  const body = '{"orderId":"123"}';

  it('produces a single signature when there is no active previous secret', () => {
    const subscriber = makeSubscriber();
    const { signatureHeader } = buildSignatureHeader(body, subscriber, key);

    expect(signatureHeader.split(',')).toHaveLength(1);
  });

  it('produces a single signature when the previous secret has expired', () => {
    const subscriber = makeSubscriber({
      previousSecretEncrypted: encryptSecret('old-secret', key),
      previousSecretExpiresAt: new Date(Date.now() - 1000),
    });
    const { signatureHeader } = buildSignatureHeader(body, subscriber, key);

    expect(signatureHeader.split(',')).toHaveLength(1);
  });

  it('signs with both secrets during an active rotation grace period', () => {
    const subscriber = makeSubscriber({
      previousSecretEncrypted: encryptSecret('old-secret', key),
      previousSecretExpiresAt: new Date(Date.now() + 60_000),
    });

    const { timestamp, signatureHeader } = buildSignatureHeader(body, subscriber, key);
    const entries = signatureHeader.split(',').map((entry) => entry.trim());
    expect(entries).toHaveLength(2);

    const verifiesWithCurrent = verify({
      payload: body,
      secret: 'current-secret',
      signatureHeader,
      timestampHeader: String(timestamp),
    });
    const verifiesWithOld = verify({
      payload: body,
      secret: 'old-secret',
      signatureHeader,
      timestampHeader: String(timestamp),
    });

    expect(verifiesWithCurrent).toBe(true);
    expect(verifiesWithOld).toBe(true);
  });

  it('does not verify with a secret that was never active', () => {
    const subscriber = makeSubscriber({
      previousSecretEncrypted: encryptSecret('old-secret', key),
      previousSecretExpiresAt: new Date(Date.now() + 60_000),
    });

    const { timestamp, signatureHeader } = buildSignatureHeader(body, subscriber, key);

    const verifiesWithUnrelatedSecret = verify({
      payload: body,
      secret: 'some-other-secret',
      signatureHeader,
      timestampHeader: String(timestamp),
    });

    expect(verifiesWithUnrelatedSecret).toBe(false);
  });
});
