import { Inject, Injectable } from '@nestjs/common';

import type { Subscriber, SubscriberPatch } from '../domain/subscriber';
import { assertSafeTargetUrl } from '../domain/target-url';
import {
  SUBSCRIBER_REPOSITORY,
  type SubscriberRepository,
} from './ports/subscriber-repository.port';

@Injectable()
export class UpdateSubscriberUseCase {
  constructor(@Inject(SUBSCRIBER_REPOSITORY) private readonly subscribers: SubscriberRepository) {}

  async execute(id: string, patch: SubscriberPatch): Promise<Subscriber | null> {
    if (patch.targetUrl !== undefined) {
      await assertSafeTargetUrl(patch.targetUrl);
    }
    return this.subscribers.update(id, patch);
  }
}
