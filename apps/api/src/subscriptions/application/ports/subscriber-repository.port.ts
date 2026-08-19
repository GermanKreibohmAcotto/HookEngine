import type { NewSubscriber, Subscriber, SubscriberPatch } from '../../domain/subscriber';

export const SUBSCRIBER_REPOSITORY = Symbol('SUBSCRIBER_REPOSITORY');

export interface SubscriberRepository {
  create(subscriber: NewSubscriber): Promise<Subscriber>;
  findById(id: string): Promise<Subscriber | null>;
  /** Active subscribers whose `eventTypes` include the given type. */
  findActiveByEventType(eventType: string): Promise<Subscriber[]>;
  list(): Promise<Subscriber[]>;
  update(id: string, patch: SubscriberPatch): Promise<Subscriber | null>;
  delete(id: string): Promise<boolean>;
  /** Atomically moves the current secret to "previous" (valid until graceDurationMs from now) and installs a new current secret. */
  rotateSecret(
    id: string,
    newSecretEncrypted: string,
    graceDurationMs: number,
  ): Promise<Subscriber | null>;
}
