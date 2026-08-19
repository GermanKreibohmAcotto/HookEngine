import { describe, expect, it } from 'vitest';

import {
  decryptSecret,
  encryptSecret,
  generateWebhookSecret,
  parseEncryptionKey,
} from './webhook-secret';

describe('webhook secret encryption', () => {
  const key = parseEncryptionKey('00'.repeat(32));

  it('generates a secret with a recognizable prefix', () => {
    const secret = generateWebhookSecret();
    expect(secret).toMatch(/^whsec_[0-9a-f]{64}$/);
  });

  it('round-trips a secret through encrypt/decrypt', () => {
    const secret = generateWebhookSecret();
    const encrypted = encryptSecret(secret, key);

    expect(encrypted).not.toContain(secret);
    expect(decryptSecret(encrypted, key)).toBe(secret);
  });

  it('produces different ciphertext for the same plaintext (random IV)', () => {
    const secret = generateWebhookSecret();
    expect(encryptSecret(secret, key)).not.toBe(encryptSecret(secret, key));
  });

  it('rejects tampered ciphertext', () => {
    const encrypted = encryptSecret('super-secret', key);
    const buffer = Buffer.from(encrypted, 'base64');
    buffer[buffer.length - 1] = (buffer[buffer.length - 1] ?? 0) ^ 0xff;

    expect(() => decryptSecret(buffer.toString('base64'), key)).toThrow();
  });

  it('fails to decrypt with the wrong key', () => {
    const encrypted = encryptSecret('super-secret', key);
    const wrongKey = parseEncryptionKey('11'.repeat(32));

    expect(() => decryptSecret(encrypted, wrongKey)).toThrow();
  });
});
