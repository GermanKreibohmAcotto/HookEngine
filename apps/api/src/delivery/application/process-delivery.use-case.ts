import { Inject, Injectable, Logger } from '@nestjs/common';

import { DeferredError } from '../domain/deferred-error';
import type { DeliveryStatus } from '../domain/delivery';
import { computeBackoffDelayMs } from '../domain/retry-policy';
import { RetryableDeliveryError } from '../domain/retryable-delivery-error';
import {
  DELIVERY_EVENT_PUBLISHER,
  type DeliveryEventPublisher,
} from './ports/delivery-event-publisher.port';
import {
  DELIVERY_REPOSITORY,
  type DeliveryAttemptUpdate,
  type DeliveryRepository,
} from './ports/delivery-repository.port';
import type { JobControl } from './ports/job-control.port';
import { WEBHOOK_DISPATCHER, type WebhookDispatcher } from './ports/webhook-dispatcher.port';

@Injectable()
export class ProcessDeliveryUseCase {
  private readonly logger = new Logger(ProcessDeliveryUseCase.name);

  constructor(
    @Inject(DELIVERY_REPOSITORY) private readonly deliveries: DeliveryRepository,
    @Inject(WEBHOOK_DISPATCHER) private readonly dispatcher: WebhookDispatcher,
    @Inject(DELIVERY_EVENT_PUBLISHER) private readonly events: DeliveryEventPublisher,
  ) {}

  /**
   * Throws RetryableDeliveryError to signal a normal backoff retry, or
   * DeferredError (after already rescheduling via jobControl) when the
   * dispatcher held off entirely — rate limited or circuit open. Returns
   * normally once the delivery reaches a terminal state.
   */
  async execute(deliveryId: string, jobControl: JobControl): Promise<void> {
    const context = await this.deliveries.findWithContext(deliveryId);
    if (!context) {
      this.logger.warn(`Delivery ${deliveryId} not found — skipping`);
      return;
    }

    const { delivery, subscriber, event } = context;

    if (delivery.status === 'succeeded' || delivery.status === 'dead') {
      return; // already terminal — a duplicate or late job invocation
    }

    const attemptNumber = delivery.attemptCount + 1;

    if (!subscriber.isActive) {
      await this.deliveries.recordAttempt({
        deliveryId,
        attemptNumber,
        requestHeaders: {},
        responseStatus: null,
        responseBodyTruncated: null,
        latencyMs: null,
        errorMessage: 'Subscriber is inactive',
        update: { outcome: 'dead' },
      });
      await this.publishSafely({
        deliveryId,
        subscriberId: subscriber.id,
        subscriberName: subscriber.name,
        eventType: event.eventType,
        status: 'dead',
        attemptNumber,
        responseStatus: null,
        latencyMs: null,
        attemptedAt: new Date().toISOString(),
      });
      return;
    }

    const result = await this.dispatcher.dispatch(context);
    const { outcome } = result;

    if (outcome.kind === 'deferred') {
      // Nothing was attempted — no attempt row, no status change, no budget spent.
      await jobControl.defer(outcome.retryAfterMs);
      throw new DeferredError(outcome.reason, outcome.retryAfterMs);
    }

    // maxRetries counts retries *after* the first attempt, so maxRetries=8
    // allows 9 total attempts (1 initial + 8 retries) before giving up.
    const exhausted = outcome.kind !== 'success' && attemptNumber > subscriber.maxRetries;
    const update: DeliveryAttemptUpdate =
      outcome.kind === 'success'
        ? { outcome: 'succeeded' }
        : outcome.kind === 'permanent-failure' || exhausted
          ? { outcome: 'dead' }
          : {
              outcome: 'retrying',
              nextAttemptAt: new Date(
                Date.now() + (outcome.retryAfterMs ?? computeBackoffDelayMs(attemptNumber)),
              ),
            };

    await this.deliveries.recordAttempt({
      deliveryId,
      attemptNumber,
      requestHeaders: result.requestHeaders,
      responseStatus: result.responseStatus,
      responseBodyTruncated: result.responseBodyTruncated,
      latencyMs: result.latencyMs,
      errorMessage: outcome.kind === 'success' ? null : outcome.reason,
      update,
    });

    await this.publishSafely({
      deliveryId,
      subscriberId: subscriber.id,
      subscriberName: subscriber.name,
      eventType: event.eventType,
      status: toDeliveryStatus(update),
      attemptNumber,
      responseStatus: result.responseStatus,
      latencyMs: result.latencyMs,
      attemptedAt: new Date().toISOString(),
    });

    if (update.outcome === 'retrying') {
      const delayMs = Math.max(0, update.nextAttemptAt.getTime() - Date.now());
      const reason = outcome.kind === 'success' ? 'delivery failed' : outcome.reason;
      throw new RetryableDeliveryError(reason, delayMs);
    }
  }

  private async publishSafely(
    payload: Parameters<DeliveryEventPublisher['publish']>[0],
  ): Promise<void> {
    try {
      await this.events.publish(payload);
    } catch (error) {
      this.logger.warn(
        `Failed to publish delivery event for ${payload.deliveryId} — the dashboard just won't see it live`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}

function toDeliveryStatus(update: DeliveryAttemptUpdate): DeliveryStatus {
  if (update.outcome === 'succeeded') return 'succeeded';
  if (update.outcome === 'dead') return 'dead';
  return 'failed';
}
