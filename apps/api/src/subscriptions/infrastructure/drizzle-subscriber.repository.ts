import { Inject, Injectable } from '@nestjs/common';
import { and, arrayContains, eq, sql } from 'drizzle-orm';

import { type Database } from '../../shared/db/client';
import { DRIZZLE } from '../../shared/db/db.module';
import { subscribers } from '../../shared/db/schema';
import type { SubscriberRepository } from '../application/ports/subscriber-repository.port';
import type { NewSubscriber, Subscriber, SubscriberPatch } from '../domain/subscriber';

type SubscriberRow = typeof subscribers.$inferSelect;

function mapRow(row: SubscriberRow): Subscriber {
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

@Injectable()
export class DrizzleSubscriberRepository implements SubscriberRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async create(subscriber: NewSubscriber): Promise<Subscriber> {
    const [row] = await this.db
      .insert(subscribers)
      .values({
        name: subscriber.name,
        targetUrl: subscriber.targetUrl,
        secretEncrypted: subscriber.secretEncrypted,
        eventTypes: [...subscriber.eventTypes],
        ...(subscriber.timeoutMs !== undefined && { timeoutMs: subscriber.timeoutMs }),
        ...(subscriber.maxRetries !== undefined && { maxRetries: subscriber.maxRetries }),
        ...(subscriber.rateLimitPerSec !== undefined && {
          rateLimitPerSec: subscriber.rateLimitPerSec,
        }),
      })
      .returning();

    if (!row) {
      throw new Error('Insert into subscribers returned no row');
    }
    return mapRow(row);
  }

  async findById(id: string): Promise<Subscriber | null> {
    const [row] = await this.db.select().from(subscribers).where(eq(subscribers.id, id)).limit(1);
    return row ? mapRow(row) : null;
  }

  async findActiveByEventType(eventType: string): Promise<Subscriber[]> {
    const rows = await this.db
      .select()
      .from(subscribers)
      .where(
        and(eq(subscribers.isActive, true), arrayContains(subscribers.eventTypes, [eventType])),
      );
    return rows.map(mapRow);
  }

  async list(): Promise<Subscriber[]> {
    const rows = await this.db.select().from(subscribers);
    return rows.map(mapRow);
  }

  async update(id: string, patch: SubscriberPatch): Promise<Subscriber | null> {
    const values: Partial<typeof subscribers.$inferInsert> = { updatedAt: new Date() };
    if (patch.name !== undefined) values.name = patch.name;
    if (patch.targetUrl !== undefined) values.targetUrl = patch.targetUrl;
    if (patch.eventTypes !== undefined) values.eventTypes = [...patch.eventTypes];
    if (patch.isActive !== undefined) values.isActive = patch.isActive;
    if (patch.timeoutMs !== undefined) values.timeoutMs = patch.timeoutMs;
    if (patch.maxRetries !== undefined) values.maxRetries = patch.maxRetries;
    if (patch.rateLimitPerSec !== undefined) values.rateLimitPerSec = patch.rateLimitPerSec;

    const [row] = await this.db
      .update(subscribers)
      .set(values)
      .where(eq(subscribers.id, id))
      .returning();
    return row ? mapRow(row) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db
      .delete(subscribers)
      .where(eq(subscribers.id, id))
      .returning({ id: subscribers.id });
    return result.length > 0;
  }

  async rotateSecret(
    id: string,
    newSecretEncrypted: string,
    graceDurationMs: number,
  ): Promise<Subscriber | null> {
    // A single UPDATE so "old value moves to previous" and "new value takes
    // over" happen atomically — every SET expression here sees the pre-update
    // row, so there's no read-modify-write race with a concurrent rotation.
    const [row] = await this.db
      .update(subscribers)
      .set({
        previousSecretEncrypted: sql`${subscribers.secretEncrypted}`,
        previousSecretExpiresAt: new Date(Date.now() + graceDurationMs),
        secretEncrypted: newSecretEncrypted,
        updatedAt: new Date(),
      })
      .where(eq(subscribers.id, id))
      .returning();

    return row ? mapRow(row) : null;
  }
}
