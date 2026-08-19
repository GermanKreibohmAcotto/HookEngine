import { Module } from '@nestjs/common';

import { DELIVERY_EVENT_PUBLISHER } from '../application/ports/delivery-event-publisher.port';
import { DELIVERY_REPOSITORY } from '../application/ports/delivery-repository.port';
import { WEBHOOK_DISPATCHER } from '../application/ports/webhook-dispatcher.port';
import { ProcessDeliveryUseCase } from '../application/process-delivery.use-case';
import { CircuitBreakerService } from './circuit-breaker.service';
import { CircuitBreakingDispatcher } from './circuit-breaking-dispatcher.decorator';
import { DeliveryProcessor } from './delivery.processor';
import { RAW_WEBHOOK_DISPATCHER, RATE_LIMITED_WEBHOOK_DISPATCHER } from './dispatcher-tokens';
import { DrizzleDeliveryRepository } from './drizzle-delivery.repository';
import { RateLimitedDispatcher } from './rate-limited-dispatcher.decorator';
import { RedisDeliveryEventPublisher } from './redis-delivery-event-publisher';
import { TokenBucketRateLimiter } from './token-bucket-rate-limiter';
import { UndiciWebhookDispatcher } from './undici-webhook-dispatcher';

/**
 * Consumer side of delivery — kept out of DeliveryModule (the producer)
 * so importing it can never accidentally start a BullMQ Worker inside the
 * HTTP process. Import this only from the worker's own module tree.
 *
 * WEBHOOK_DISPATCHER resolves to a decorator chain:
 *   CircuitBreakingDispatcher -> RateLimitedDispatcher -> UndiciWebhookDispatcher
 * checked in that order, so an open circuit short-circuits before a rate-limit
 * token is even considered.
 */
@Module({
  providers: [
    { provide: DELIVERY_REPOSITORY, useClass: DrizzleDeliveryRepository },
    { provide: DELIVERY_EVENT_PUBLISHER, useClass: RedisDeliveryEventPublisher },
    { provide: RAW_WEBHOOK_DISPATCHER, useClass: UndiciWebhookDispatcher },
    { provide: RATE_LIMITED_WEBHOOK_DISPATCHER, useClass: RateLimitedDispatcher },
    { provide: WEBHOOK_DISPATCHER, useClass: CircuitBreakingDispatcher },
    TokenBucketRateLimiter,
    CircuitBreakerService,
    ProcessDeliveryUseCase,
    DeliveryProcessor,
  ],
})
export class DeliveryWorkerModule {}
