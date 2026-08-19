import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Redis from 'ioredis';

import type { Env } from '../../shared/config/env.schema';
import { REDIS_CLIENT } from '../../shared/redis/redis.module';

export type CircuitCheckResult =
  { readonly allowed: true } | { readonly allowed: false; readonly retryAfterMs: number };

type CircuitRedis = Redis & {
  circuitCheck(
    stateKey: string,
    now: number,
    cooldownMs: number,
  ): Promise<[number, string, number]>;
  circuitReport(
    stateKey: string,
    failuresKey: string,
    outcome: 'success' | 'failure',
    now: number,
    windowMs: number,
    threshold: number,
    ttlSeconds: number,
  ): Promise<string>;
};

const STATE_TTL_SECONDS = 3600;

/**
 * Per-subscriber circuit breaker: closed -> open after enough 5xx/timeout
 * failures inside the sliding window, open -> half-open once the cooldown
 * elapses (letting exactly one probe through), half-open -> closed on a
 * successful probe or back to open on a failed one.
 */
@Injectable()
export class CircuitBreakerService {
  private readonly redis: CircuitRedis;

  constructor(
    @Inject(REDIS_CLIENT) redis: Redis,
    private readonly config: ConfigService<Env, true>,
  ) {
    this.redis = redis as CircuitRedis;
    this.redis.defineCommand('circuitCheck', {
      numberOfKeys: 1,
      lua: readFileSync(join(__dirname, 'circuit-breaker-check.lua'), 'utf8'),
    });
    this.redis.defineCommand('circuitReport', {
      numberOfKeys: 2,
      lua: readFileSync(join(__dirname, 'circuit-breaker-report.lua'), 'utf8'),
    });
  }

  async check(subscriberId: string): Promise<CircuitCheckResult> {
    const cooldownMs = this.config.get('CIRCUIT_BREAKER_COOLDOWN_MS', { infer: true });
    const [allowed, , retryAfterMs] = await this.redis.circuitCheck(
      stateKey(subscriberId),
      Date.now(),
      cooldownMs,
    );
    return allowed === 1 ? { allowed: true } : { allowed: false, retryAfterMs };
  }

  async reportSuccess(subscriberId: string): Promise<void> {
    await this.report(subscriberId, 'success');
  }

  async reportFailure(subscriberId: string): Promise<void> {
    await this.report(subscriberId, 'failure');
  }

  private async report(subscriberId: string, outcome: 'success' | 'failure'): Promise<void> {
    const windowMs = this.config.get('CIRCUIT_BREAKER_WINDOW_MS', { infer: true });
    const threshold = this.config.get('CIRCUIT_BREAKER_FAILURE_THRESHOLD', { infer: true });
    await this.redis.circuitReport(
      stateKey(subscriberId),
      failuresKey(subscriberId),
      outcome,
      Date.now(),
      windowMs,
      threshold,
      STATE_TTL_SECONDS,
    );
  }
}

function stateKey(subscriberId: string): string {
  return `circuit:${subscriberId}:state`;
}

function failuresKey(subscriberId: string): string {
  return `circuit:${subscriberId}:failures`;
}
