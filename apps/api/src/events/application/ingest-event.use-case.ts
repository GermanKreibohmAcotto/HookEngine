import { Inject, Injectable, Logger } from '@nestjs/common';

import {
  DELIVERY_QUEUE,
  type DeliveryQueue,
} from '../../delivery/application/ports/delivery-queue.port';
import {
  SUBSCRIBER_REPOSITORY,
  type SubscriberRepository,
} from '../../subscriptions/application/ports/subscriber-repository.port';
import { hashPayload } from '../domain/payload-hash';
import {
  EVENT_REPOSITORY,
  type EventRepository,
  type IngestEventResult,
} from './ports/event-repository.port';

export interface IngestEventInput {
  readonly eventType: string;
  readonly payload: Record<string, unknown>;
  readonly idempotencyKey: string;
}

@Injectable()
export class IngestEventUseCase {
  private readonly logger = new Logger(IngestEventUseCase.name);

  constructor(
    @Inject(EVENT_REPOSITORY) private readonly events: EventRepository,
    @Inject(SUBSCRIBER_REPOSITORY) private readonly subscribers: SubscriberRepository,
    @Inject(DELIVERY_QUEUE) private readonly queue: DeliveryQueue,
  ) {}

  async execute(input: IngestEventInput): Promise<IngestEventResult> {
    const payloadHash = hashPayload(input.payload);

    // Read outside the transaction: a subscriber added or removed a moment
    // before this event doesn't need to be perfectly consistent with it.
    const matchingSubscribers = await this.subscribers.findActiveByEventType(input.eventType);
    const subscriberIds = matchingSubscribers.map((subscriber) => subscriber.id);

    const result = await this.events.ingest(
      {
        eventType: input.eventType,
        payload: input.payload,
        idempotencyKey: input.idempotencyKey,
        payloadHash,
      },
      subscriberIds,
    );

    if (!result.alreadyIngested) {
      await Promise.all(
        result.deliveries.map((delivery) =>
          this.queue.enqueue(delivery.id).catch((error: unknown) => {
            this.logger.error(
              `Failed to enqueue delivery ${delivery.id} — it will not be dispatched until reconciled`,
              error instanceof Error ? error.stack : String(error),
            );
          }),
        ),
      );
    }

    return result;
  }
}
