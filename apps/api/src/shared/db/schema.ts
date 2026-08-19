import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

export const deliveryStatusEnum = pgEnum('delivery_status', [
  'pending',
  'delivering',
  'succeeded',
  'failed',
  'dead',
]);

export const subscribers = pgTable('subscribers', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  targetUrl: text('target_url').notNull(),
  /** AES-256-GCM ciphertext (iv + authTag + payload), never stored or returned in plaintext. */
  secretEncrypted: text('secret_encrypted').notNull(),
  /**
   * Set by secret rotation and cleared once the grace period lapses. While
   * set, deliveries are signed with both secrets so a receiver mid-rotation
   * verifies successfully no matter which one it currently has configured.
   */
  previousSecretEncrypted: text('previous_secret_encrypted'),
  previousSecretExpiresAt: timestamp('previous_secret_expires_at', { withTimezone: true }),
  eventTypes: text('event_types')
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  isActive: boolean('is_active').notNull().default(true),
  timeoutMs: integer('timeout_ms').notNull().default(10_000),
  maxRetries: integer('max_retries').notNull().default(8),
  rateLimitPerSec: integer('rate_limit_per_sec').notNull().default(5),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const events = pgTable('events', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventType: text('event_type').notNull(),
  payload: jsonb('payload').notNull(),
  idempotencyKey: text('idempotency_key').notNull().unique(),
  payloadHash: text('payload_hash').notNull(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const deliveries = pgTable(
  'deliveries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    subscriberId: uuid('subscriber_id')
      .notNull()
      .references(() => subscribers.id, { onDelete: 'cascade' }),
    status: deliveryStatusEnum('status').notNull().default('pending'),
    attemptCount: integer('attempt_count').notNull().default(0),
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => [
    index('deliveries_subscriber_status_idx').on(table.subscriberId, table.status),
    index('deliveries_status_next_attempt_idx').on(table.status, table.nextAttemptAt),
  ],
);

export const deliveryAttempts = pgTable(
  'delivery_attempts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    deliveryId: uuid('delivery_id')
      .notNull()
      .references(() => deliveries.id, { onDelete: 'cascade' }),
    attemptNumber: integer('attempt_number').notNull(),
    requestHeaders: jsonb('request_headers').notNull(),
    responseStatus: integer('response_status'),
    /** Truncated to ~8KB — a subscriber returning a huge error body shouldn't blow up storage. */
    responseBodyTruncated: text('response_body_truncated'),
    latencyMs: integer('latency_ms'),
    errorMessage: text('error_message'),
    attemptedAt: timestamp('attempted_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('delivery_attempts_delivery_attempt_idx').on(table.deliveryId, table.attemptNumber),
    index('delivery_attempts_attempted_at_idx').on(table.attemptedAt.desc()),
  ],
);
