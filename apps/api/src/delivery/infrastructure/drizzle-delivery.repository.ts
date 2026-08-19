import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, sql, type SQL } from 'drizzle-orm';

import type { WebhookEvent } from '../../events/domain/event';
import { type Database } from '../../shared/db/client';
import { DRIZZLE } from '../../shared/db/db.module';
import { deliveries, deliveryAttempts, events, subscribers } from '../../shared/db/schema';
import type { Subscriber } from '../../subscriptions/domain/subscriber';
import type {
  DeliveryFilter,
  DeliveryPage,
  DeliveryRepository,
  DeliveryWithAttempts,
  DeliveryWithContext,
  Pagination,
  RecordAttemptInput,
} from '../application/ports/delivery-repository.port';
import type { DeliveryAttempt } from '../domain/delivery-attempt';
import type { Delivery } from '../domain/delivery';

const MAX_RESPONSE_BODY_LOG_BYTES = 8 * 1024;

function mapDelivery(row: typeof deliveries.$inferSelect): Delivery {
  return {
    id: row.id,
    eventId: row.eventId,
    subscriberId: row.subscriberId,
    status: row.status,
    attemptCount: row.attemptCount,
    nextAttemptAt: row.nextAttemptAt,
    createdAt: row.createdAt,
    completedAt: row.completedAt,
  };
}

function mapEvent(row: typeof events.$inferSelect): WebhookEvent {
  return {
    id: row.id,
    eventType: row.eventType,
    payload: row.payload as Record<string, unknown>,
    idempotencyKey: row.idempotencyKey,
    payloadHash: row.payloadHash,
    occurredAt: row.occurredAt,
    createdAt: row.createdAt,
  };
}

function mapSubscriber(row: typeof subscribers.$inferSelect): Subscriber {
  return {
    id: row.id,
    name: row.name,
    targetUrl: row.targetUrl,
    secretEncrypted: row.secretEncrypted,
    previousSecretEncrypted: row.previousSecretEncrypted,
    previousSecretExpiresAt: row.previousSecretExpiresAt,
    eventTypes: row.eventTypes,
    isActive: row.isActive,
    timeoutMs: row.timeoutMs,
    maxRetries: row.maxRetries,
    rateLimitPerSec: row.rateLimitPerSec,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapAttempt(row: typeof deliveryAttempts.$inferSelect): DeliveryAttempt {
  return {
    id: row.id,
    deliveryId: row.deliveryId,
    attemptNumber: row.attemptNumber,
    requestHeaders: row.requestHeaders as Record<string, string>,
    responseStatus: row.responseStatus,
    responseBodyTruncated: row.responseBodyTruncated,
    latencyMs: row.latencyMs,
    errorMessage: row.errorMessage,
    attemptedAt: row.attemptedAt,
  };
}

@Injectable()
export class DrizzleDeliveryRepository implements DeliveryRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async findWithContext(deliveryId: string): Promise<DeliveryWithContext | null> {
    const [row] = await this.db
      .select()
      .from(deliveries)
      .innerJoin(events, eq(deliveries.eventId, events.id))
      .innerJoin(subscribers, eq(deliveries.subscriberId, subscribers.id))
      .where(eq(deliveries.id, deliveryId))
      .limit(1);

    if (!row) {
      return null;
    }

    return {
      delivery: mapDelivery(row.deliveries),
      event: mapEvent(row.events),
      subscriber: mapSubscriber(row.subscribers),
    };
  }

  async recordAttempt(input: RecordAttemptInput): Promise<void> {
    // Defense in depth — the dispatcher already caps what it reads, but the
    // column contract (~8KB) shouldn't depend on every future caller remembering that.
    const truncatedBody =
      input.responseBodyTruncated?.slice(0, MAX_RESPONSE_BODY_LOG_BYTES) ?? null;

    await this.db.transaction(async (tx) => {
      await tx.insert(deliveryAttempts).values({
        deliveryId: input.deliveryId,
        attemptNumber: input.attemptNumber,
        requestHeaders: input.requestHeaders,
        responseStatus: input.responseStatus,
        responseBodyTruncated: truncatedBody,
        latencyMs: input.latencyMs,
        errorMessage: input.errorMessage,
      });

      const now = new Date();
      if (input.update.outcome === 'succeeded') {
        await tx
          .update(deliveries)
          .set({ status: 'succeeded', attemptCount: input.attemptNumber, completedAt: now })
          .where(eq(deliveries.id, input.deliveryId));
      } else if (input.update.outcome === 'dead') {
        await tx
          .update(deliveries)
          .set({ status: 'dead', attemptCount: input.attemptNumber, completedAt: now })
          .where(eq(deliveries.id, input.deliveryId));
      } else {
        await tx
          .update(deliveries)
          .set({
            status: 'failed',
            attemptCount: input.attemptNumber,
            nextAttemptAt: input.update.nextAttemptAt,
          })
          .where(eq(deliveries.id, input.deliveryId));
      }
    });
  }

  async listDead(pagination: Pagination): Promise<DeliveryPage> {
    const [rows, countRows] = await Promise.all([
      this.db
        .select()
        .from(deliveries)
        .innerJoin(events, eq(deliveries.eventId, events.id))
        .innerJoin(subscribers, eq(deliveries.subscriberId, subscribers.id))
        .where(eq(deliveries.status, 'dead'))
        .orderBy(desc(deliveries.completedAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(deliveries)
        .where(eq(deliveries.status, 'dead')),
    ]);

    return {
      items: rows.map((row) => ({
        delivery: mapDelivery(row.deliveries),
        event: mapEvent(row.events),
        subscriber: mapSubscriber(row.subscribers),
      })),
      total: countRows[0]?.count ?? 0,
    };
  }

  async resetForRetry(deliveryId: string): Promise<boolean> {
    const [row] = await this.db
      .update(deliveries)
      .set({ status: 'pending', attemptCount: 0, nextAttemptAt: null, completedAt: null })
      .where(and(eq(deliveries.id, deliveryId), eq(deliveries.status, 'dead')))
      .returning({ id: deliveries.id });

    return row !== undefined;
  }

  async list(filter: DeliveryFilter, pagination: Pagination): Promise<DeliveryPage> {
    const conditions: SQL[] = [];
    if (filter.status) {
      conditions.push(eq(deliveries.status, filter.status));
    }
    if (filter.subscriberId) {
      conditions.push(eq(deliveries.subscriberId, filter.subscriberId));
    }
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, countRows] = await Promise.all([
      this.db
        .select()
        .from(deliveries)
        .innerJoin(events, eq(deliveries.eventId, events.id))
        .innerJoin(subscribers, eq(deliveries.subscriberId, subscribers.id))
        .where(whereClause)
        .orderBy(desc(deliveries.createdAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(deliveries)
        .where(whereClause),
    ]);

    return {
      items: rows.map((row) => ({
        delivery: mapDelivery(row.deliveries),
        event: mapEvent(row.events),
        subscriber: mapSubscriber(row.subscribers),
      })),
      total: countRows[0]?.count ?? 0,
    };
  }

  async getWithAttempts(deliveryId: string): Promise<DeliveryWithAttempts | null> {
    const context = await this.findWithContext(deliveryId);
    if (!context) {
      return null;
    }

    const attemptRows = await this.db
      .select()
      .from(deliveryAttempts)
      .where(eq(deliveryAttempts.deliveryId, deliveryId))
      .orderBy(deliveryAttempts.attemptNumber);

    return { ...context, attempts: attemptRows.map(mapAttempt) };
  }
}
