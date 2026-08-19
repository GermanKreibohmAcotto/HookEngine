import type { Job } from 'bullmq';

import type { JobControl } from '../application/ports/job-control.port';
import type { DeliveryJobData } from './bullmq-delivery-queue.adapter';

export class BullmqJobControl implements JobControl {
  constructor(
    private readonly job: Job<DeliveryJobData>,
    private readonly token: string | undefined,
  ) {}

  async defer(delayMs: number): Promise<void> {
    await this.job.moveToDelayed(Date.now() + delayMs, this.token);
  }
}
