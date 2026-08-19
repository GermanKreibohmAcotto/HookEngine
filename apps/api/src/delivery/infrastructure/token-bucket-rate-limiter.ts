import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';

import { REDIS_CLIENT } from '../../shared/redis/redis.module';

export interface RateLimitResult {
  readonly allowed: boolean;
  readonly retryAfterMs: number;
}

type RateLimiterRedis = Redis & {
  tokenBucket(
    key: string,
    rate: number,
    capacity: number,
    now: number,
    requested: number,
  ): Promise<[number, number]>;
};

/**
 * Per-domain token bucket, keyed by the subscriber's target hostname — a
 * saturated destination shouldn't be hammered just because several
 * subscribers happen to point at it. Not per-subscriber: the whole point is
 * to protect the shared downstream host.
 */
@Injectable()
export class TokenBucketRateLimiter {
  private readonly redis: RateLimiterRedis;

  constructor(@Inject(REDIS_CLIENT) redis: Redis) {
    this.redis = redis as RateLimiterRedis;
    this.redis.defineCommand('tokenBucket', {
      numberOfKeys: 1,
      lua: readFileSync(join(__dirname, 'rate-limiter.lua'), 'utf8'),
    });
  }

  async consume(domain: string, ratePerSecond: number, capacity: number): Promise<RateLimitResult> {
    const [allowed, retryAfterMs] = await this.redis.tokenBucket(
      `ratelimit:${domain}`,
      ratePerSecond,
      capacity,
      Date.now(),
      1,
    );
    return { allowed: allowed === 1, retryAfterMs };
  }
}
