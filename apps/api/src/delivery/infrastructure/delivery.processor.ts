import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DelayedError, type Job, Worker } from 'bullmq';
import Redis from 'ioredis';

import type { Env } from '../../shared/config/env.schema';
import { ProcessDeliveryUseCase } from '../application/process-delivery.use-case';
import { DeferredError } from '../domain/deferred-error';
import { computeBackoffDelayMs } from '../domain/retry-policy';
import { RetryableDeliveryError } from '../domain/retryable-delivery-error';
import { BullmqJobControl } from './bullmq-job-control';
import { DELIVERY_QUEUE_NAME, type DeliveryJobData } from './bullmq-delivery-queue.adapter';

@Injectable()
export class DeliveryProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DeliveryProcessor.name);
  private worker: Worker<DeliveryJobData> | undefined;
  private connection: Redis | undefined;

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly processDelivery: ProcessDeliveryUseCase,
  ) {}

  onModuleInit(): void {
    // A dedicated connection — BullMQ Workers issue blocking commands and
    // shouldn't share a connection with other consumers.
    this.connection = new Redis(this.config.get('REDIS_URL', { infer: true }), {
      maxRetriesPerRequest: null,
    });

    const concurrency = this.config.get('WORKER_CONCURRENCY', { infer: true });

    this.worker = new Worker<DeliveryJobData>(
      DELIVERY_QUEUE_NAME,
      async (job: Job<DeliveryJobData>, token?: string): Promise<void> => {
        try {
          await this.processDelivery.execute(job.data.deliveryId, new BullmqJobControl(job, token));
        } catch (error) {
          if (error instanceof DeferredError) {
            // The use case already called jobControl.defer() (moveToDelayed) —
            // this special error is only how it tells BullMQ's own state
            // machine "don't treat this as a failed attempt".
            throw new DelayedError();
          }
          throw error;
        }
      },
      {
        connection: this.connection,
        concurrency,
        settings: {
          backoffStrategy: (attemptsMade: number, _type?: string, error?: Error): number =>
            error instanceof RetryableDeliveryError && error.delayMs !== undefined
              ? error.delayMs
              : computeBackoffDelayMs(attemptsMade),
        },
      },
    );

    this.worker.on('failed', (job, error) => {
      this.logger.warn(`Delivery job ${job?.id ?? 'unknown'} attempt errored: ${error.message}`);
    });

    this.logger.log(`Delivery worker listening (concurrency=${concurrency})`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.connection?.quit();
  }
}
