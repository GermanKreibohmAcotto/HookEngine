import { Controller, Get, HttpException, HttpStatus, Inject } from '@nestjs/common';
import type Redis from 'ioredis';
import type { Pool } from 'pg';

import { PG_POOL } from '../shared/db/db.module';
import { REDIS_CLIENT } from '../shared/redis/redis.module';

interface HealthChecks {
  postgres: 'ok' | 'error';
  redis: 'ok' | 'error';
}

@Controller('health')
export class HealthController {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  @Get()
  async check(): Promise<{ status: 'ok'; checks: HealthChecks }> {
    const [postgres, redis] = await Promise.allSettled([
      this.pool.query('SELECT 1'),
      this.redis.ping(),
    ]);

    const checks: HealthChecks = {
      postgres: postgres.status === 'fulfilled' ? 'ok' : 'error',
      redis: redis.status === 'fulfilled' ? 'ok' : 'error',
    };

    const healthy = checks.postgres === 'ok' && checks.redis === 'ok';
    if (!healthy) {
      throw new HttpException({ status: 'error', checks }, HttpStatus.SERVICE_UNAVAILABLE);
    }

    return { status: 'ok', checks };
  }
}
