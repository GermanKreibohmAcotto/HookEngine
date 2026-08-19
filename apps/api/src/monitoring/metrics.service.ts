import { Inject, Injectable } from '@nestjs/common';
import { and, gte, isNotNull, sql } from 'drizzle-orm';

import { type Database } from '../shared/db/client';
import { DRIZZLE } from '../shared/db/db.module';
import { deliveries, deliveryAttempts } from '../shared/db/schema';

export interface MetricsOverview {
  readonly windowMinutes: number;
  readonly byStatus: Record<string, number>;
  readonly successRate: number | null;
  readonly latencyMs: {
    readonly p50: number | null;
    readonly p95: number | null;
    readonly p99: number | null;
  };
  readonly statusCodeDistribution: Record<string, number>;
}

@Injectable()
export class MetricsService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async overview(windowMinutes: number): Promise<MetricsOverview> {
    const since = new Date(Date.now() - windowMinutes * 60_000);

    const [statusCounts, latencyRows, statusCodeCounts] = await Promise.all([
      this.db
        .select({ status: deliveries.status, count: sql<number>`count(*)::int` })
        .from(deliveries)
        .where(gte(deliveries.createdAt, since))
        .groupBy(deliveries.status),
      this.db
        .select({
          p50: sql<
            number | null
          >`percentile_cont(0.5) within group (order by ${deliveryAttempts.latencyMs})::float`,
          p95: sql<
            number | null
          >`percentile_cont(0.95) within group (order by ${deliveryAttempts.latencyMs})::float`,
          p99: sql<
            number | null
          >`percentile_cont(0.99) within group (order by ${deliveryAttempts.latencyMs})::float`,
        })
        .from(deliveryAttempts)
        .where(
          and(gte(deliveryAttempts.attemptedAt, since), isNotNull(deliveryAttempts.latencyMs)),
        ),
      this.db
        .select({
          responseStatus: deliveryAttempts.responseStatus,
          count: sql<number>`count(*)::int`,
        })
        .from(deliveryAttempts)
        .where(
          and(gte(deliveryAttempts.attemptedAt, since), isNotNull(deliveryAttempts.responseStatus)),
        )
        .groupBy(deliveryAttempts.responseStatus),
    ]);

    const byStatus: Record<string, number> = {};
    for (const row of statusCounts) {
      byStatus[row.status] = row.count;
    }

    const succeeded = byStatus.succeeded ?? 0;
    const dead = byStatus.dead ?? 0;
    const totalTerminal = succeeded + dead;

    const statusCodeDistribution: Record<string, number> = {};
    for (const row of statusCodeCounts) {
      if (row.responseStatus !== null) {
        statusCodeDistribution[String(row.responseStatus)] = row.count;
      }
    }

    return {
      windowMinutes,
      byStatus,
      successRate: totalTerminal > 0 ? succeeded / totalTerminal : null,
      latencyMs: {
        p50: latencyRows[0]?.p50 ?? null,
        p95: latencyRows[0]?.p95 ?? null,
        p99: latencyRows[0]?.p99 ?? null,
      },
      statusCodeDistribution,
    };
  }
}
