import { beforeEach, describe, expect, it, vi } from 'vitest';

import { assertSafeTargetUrl } from './target-url';

const { resolve4Mock, resolve6Mock } = vi.hoisted(() => ({
  resolve4Mock: vi.fn(),
  resolve6Mock: vi.fn(),
}));

vi.mock('node:dns', () => ({
  promises: { resolve4: resolve4Mock, resolve6: resolve6Mock },
}));

describe('assertSafeTargetUrl', () => {
  beforeEach(() => {
    const notFound = Object.assign(new Error('ENOTFOUND'), { code: 'ENOTFOUND' });
    resolve4Mock.mockReset().mockRejectedValue(notFound);
    resolve6Mock.mockReset().mockRejectedValue(notFound);
  });

  it('accepts a public IPv4 literal', async () => {
    const url = await assertSafeTargetUrl('https://8.8.8.8/webhooks');
    expect(url.hostname).toBe('8.8.8.8');
  });

  it('rejects loopback IPv4 literals', async () => {
    await expect(assertSafeTargetUrl('http://127.0.0.1/hook')).rejects.toMatchObject({
      code: 'TARGET_URL_PRIVATE_ADDRESS',
    });
  });

  it('rejects the localhost hostname', async () => {
    await expect(assertSafeTargetUrl('http://localhost:3000/hook')).rejects.toMatchObject({
      code: 'TARGET_URL_LOCALHOST',
    });
  });

  it.each(['10.0.0.5', '172.16.5.1', '192.168.1.1'])(
    'rejects RFC1918 private address %s',
    async (address) => {
      await expect(assertSafeTargetUrl(`http://${address}/hook`)).rejects.toMatchObject({
        code: 'TARGET_URL_PRIVATE_ADDRESS',
      });
    },
  );

  it('rejects the cloud metadata link-local address', async () => {
    await expect(
      assertSafeTargetUrl('http://169.254.169.254/latest/meta-data'),
    ).rejects.toMatchObject({ code: 'TARGET_URL_PRIVATE_ADDRESS' });
  });

  it('rejects IPv6 loopback', async () => {
    await expect(assertSafeTargetUrl('http://[::1]/hook')).rejects.toMatchObject({
      code: 'TARGET_URL_PRIVATE_ADDRESS',
    });
  });

  it('rejects an IPv4-mapped IPv6 loopback bypass attempt', async () => {
    await expect(assertSafeTargetUrl('http://[::ffff:127.0.0.1]/hook')).rejects.toMatchObject({
      code: 'TARGET_URL_PRIVATE_ADDRESS',
    });
  });

  it('accepts a public IPv6 literal', async () => {
    const url = await assertSafeTargetUrl('http://[2001:4860:4860::8888]/hook');
    expect(url.hostname).toBe('[2001:4860:4860::8888]');
  });

  it('rejects non-http(s) protocols', async () => {
    await expect(assertSafeTargetUrl('ftp://example.com/hook')).rejects.toMatchObject({
      code: 'TARGET_URL_UNSUPPORTED_PROTOCOL',
    });
  });

  it('rejects a malformed URL', async () => {
    await expect(assertSafeTargetUrl('not a url')).rejects.toMatchObject({
      code: 'TARGET_URL_INVALID',
    });
  });

  it('accepts a hostname that resolves to a public address', async () => {
    resolve4Mock.mockResolvedValueOnce(['93.184.216.34']);

    const url = await assertSafeTargetUrl('https://public.example.com/hook');

    expect(url.hostname).toBe('public.example.com');
    expect(resolve4Mock).toHaveBeenCalledWith('public.example.com');
  });

  it('rejects a hostname that resolves to a private address (DNS rebinding attempt)', async () => {
    resolve4Mock.mockResolvedValueOnce(['10.0.0.1']);

    await expect(assertSafeTargetUrl('https://sneaky.example.com/hook')).rejects.toMatchObject({
      code: 'TARGET_URL_RESOLVES_PRIVATE',
      details: { hostname: 'sneaky.example.com', address: '10.0.0.1' },
    });
  });

  it('rejects a hostname that fails to resolve', async () => {
    await expect(
      assertSafeTargetUrl('https://does-not-exist.example.com/hook'),
    ).rejects.toMatchObject({ code: 'TARGET_URL_DNS_FAILED' });
  });
});
