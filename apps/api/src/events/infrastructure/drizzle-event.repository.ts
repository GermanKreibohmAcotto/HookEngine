import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DatabaseError } from 'pg';

import type { Delivery } from '../../delivery/domain/delivery';
import { type Database } from '../../shared/db/client';
import { DRIZZLE } from '../../shared/db/db.module';
import { deliveries, events } from '../../shared/db/schema';
import type {
  EventRepository,
  IngestEventResult,
} from '../application/ports/event-repository.port';
import type { NewWebhookEvent, WebhookEvent } from '../domain/event';
import { IdempotencyConflictError } from '../domain/idempotency-conflict.error';

type EventRow = typeof events.$inferSelect;
type DeliveryRow = typeof deliveries.$inferSelect;

const IDEMPOTENCY_KEY_UNIQUE_CONSTRAINT = 'events_idempotency_key_unique';

/**
 * drizzle-orm wraps driver errors in its own DrizzleQueryError, with the raw
 * `pg` DatabaseError (the thing that actually carries `.code`/`.constraint`)
 * underneath as `.cause` — checking `instanceof DatabaseError` on the caught
 * error directly misses every real unique-violation.
 */
function isUniqueViolation(error: unknown, constraintName: string): boolean {
  const dbError =
    error instanceof DatabaseError
      ? error
      : error instanceof Error && error.cause instanceof DatabaseError
        ? error.cause
        : undefined;
  return dbError?.code === '23505' && dbError.constraint === constraintName;
}

function mapEvent(row: EventRow): WebhookEvent {
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

function mapDelivery(row: DeliveryRow): Delivery {
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

@Injectable()
export class DrizzleEventRepository implements EventRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async ingest(
    input: NewWebhookEvent,
    subscriberIds: readonly string[],
  ): Promise<IngestEventResult> {
    try {
      return await this.db.transaction(async (tx) => {
        const [eventRow] = await tx
          .insert(events)
          .values({
            eventType: input.eventType,
            payload: input.payload,
            idempotencyKey: input.idempotencyKey,
            payloadHash: input.payloadHash,
          })
          .returning();

        if (!eventRow) {
          throw new Error('Insert into events returned no row');
        }

        const deliveryRows =
          subscriberIds.length > 0
            ? await tx
                .insert(deliveries)
                .values(
                  subscriberIds.map((subscriberId) => ({ eventId: eventRow.id, subscriberId })),
                )
                .returning()
            : [];

        return {
          event: mapEvent(eventRow),
          deliveries: deliveryRows.map(mapDelivery),
          alreadyIngested: false,
        };
      });
    } catch (error) {
      if (isUniqueViolation(error, IDEMPOTENCY_KEY_UNIQUE_CONSTRAINT)) {
        return this.resolveExistingIngestion(input);
      }
      throw error;
    }
  }

  private async resolveExistingIngestion(input: NewWebhookEvent): Promise<IngestEventResult> {
    const [existingRow] = await this.db
      .select()
      .from(events)
      .where(eq(events.idempotencyKey, input.idempotencyKey))
      .limit(1);

    if (!existingRow) {
      throw new Error(
        `Idempotency key "${input.idempotencyKey}" conflicted on insert but could not be re-read`,
      );
    }

    const existingEvent = mapEvent(existingRow);
    if (existingEvent.payloadHash !== input.payloadHash) {
      throw new IdempotencyConflictError(input.idempotencyKey);
    }

    const existingDeliveries = await this.db
      .select()
      .from(deliveries)
      .where(eq(deliveries.eventId, existingEvent.id));

    return {
      event: existingEvent,
      deliveries: existingDeliveries.map(mapDelivery),
      alreadyIngested: true,
    };
  }
}
