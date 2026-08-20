import { promises as dns } from 'node:dns';

import ipaddr from 'ipaddr.js';

import type { ErrorCode } from '../../shared/http/error-codes';

export class UnsafeTargetUrlError extends Error {
  constructor(
    reason: string,
    readonly code: ErrorCode,
    readonly details: Record<string, unknown> = {},
  ) {
    super(`Refusing to register target URL: ${reason}`);
    this.name = 'UnsafeTargetUrlError';
  }
}

/**
 * A webhook engine is, by design, a service that makes HTTP requests to URLs
 * supplied by API clients — without this guard it's a ready-made SSRF proxy
 * into whatever network it runs on. Ranges rejected: unspecified (0.0.0.0/::),
 * loopback, RFC1918/uniqueLocal private space, and link-local (which covers
 * the 169.254.169.254 cloud metadata endpoint).
 */
const BLOCKED_RANGES = new Set(['unspecified', 'loopback', 'private', 'linkLocal', 'uniqueLocal']);

function isBlockedAddress(address: string): boolean {
  if (!ipaddr.isValid(address)) {
    return true; // fail closed on anything we can't parse
  }
  // process() unwraps IPv4-mapped IPv6 (::ffff:127.0.0.1) before classifying —
  // otherwise that's a one-line bypass of the loopback check.
  return BLOCKED_RANGES.has(ipaddr.process(address).range());
}

/**
 * `new URL('http://[::1]/').hostname` is `"[::1]"` — the WHATWG URL spec
 * keeps the brackets — but ipaddr.js only accepts the bracket-free form.
 * Without this, every bracketed IPv6 literal falls through to DNS
 * resolution instead of being classified directly, which happens to still
 * reject loopback/private literals (DNS resolution of a bogus "hostname"
 * fails) but would also incorrectly reject a legitimate public IPv6 target.
 */
function stripIPv6Brackets(hostname: string): string {
  return hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;
}

/**
 * Resolves via `dns.resolve4`/`resolve6` (real DNS queries) rather than
 * `dns.lookup` (the OS resolver via getaddrinfo) — on musl libc (Alpine,
 * i.e. our own Docker image) `dns.lookup` can hang for seconds to indefinitely
 * on external hostnames, especially when it tries AAAA first over a container
 * network without working IPv6.
 */
async function resolveAddresses(hostname: string): Promise<string[]> {
  const [v4, v6] = await Promise.allSettled([dns.resolve4(hostname), dns.resolve6(hostname)]);

  const addresses: string[] = [];
  if (v4.status === 'fulfilled') addresses.push(...v4.value);
  if (v6.status === 'fulfilled') addresses.push(...v6.value);

  if (addresses.length === 0) {
    throw new UnsafeTargetUrlError(
      `could not resolve hostname "${hostname}"`,
      'TARGET_URL_DNS_FAILED',
      {
        hostname,
      },
    );
  }
  return addresses;
}

/**
 * Validates a subscriber target URL at registration time. This does not
 * protect against DNS rebinding (the hostname could re-resolve to a private
 * address between now and actual dispatch) — the dispatcher in
 * `delivery/infrastructure` re-validates and pins the resolved address for
 * the outbound connection itself.
 */
export async function assertSafeTargetUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UnsafeTargetUrlError('not a valid URL', 'TARGET_URL_INVALID');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new UnsafeTargetUrlError(
      'only http and https URLs are allowed',
      'TARGET_URL_UNSUPPORTED_PROTOCOL',
      { protocol: url.protocol },
    );
  }

  const hostname = url.hostname.toLowerCase();
  if (hostname === 'localhost') {
    throw new UnsafeTargetUrlError('localhost is not allowed', 'TARGET_URL_LOCALHOST');
  }

  const ipLiteral = stripIPv6Brackets(hostname);
  if (ipaddr.isValid(ipLiteral)) {
    if (isBlockedAddress(ipLiteral)) {
      throw new UnsafeTargetUrlError(
        `${hostname} is a private, loopback, or link-local address`,
        'TARGET_URL_PRIVATE_ADDRESS',
        { hostname },
      );
    }
    return url;
  }

  const addresses = await resolveAddresses(hostname);

  for (const address of addresses) {
    if (isBlockedAddress(address)) {
      throw new UnsafeTargetUrlError(
        `hostname "${hostname}" resolves to ${address}, a private, loopback, or link-local address`,
        'TARGET_URL_RESOLVES_PRIVATE',
        { hostname, address },
      );
    }
  }

  return url;
}
