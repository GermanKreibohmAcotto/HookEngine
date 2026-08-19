import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from '../../shared/config/env.schema';
import type { Subscriber } from '../domain/subscriber';
import { encryptSecret, generateWebhookSecret, parseEncryptionKey } from '../domain/webhook-secret';
import {
  SUBSCRIBER_REPOSITORY,
  type SubscriberRepository,
} from './ports/subscriber-repository.port';

export interface RotateSecretResult {
  readonly subscriber: Subscriber;
  /** Shown to the caller exactly once, same as at creation. */
  readonly plaintextSecret: string;
}

@Injectable()
export class RotateSecretUseCase {
  constructor(
    @Inject(SUBSCRIBER_REPOSITORY) private readonly subscribers: SubscriberRepository,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async execute(subscriberId: string): Promise<RotateSecretResult | null> {
    const plaintextSecret = generateWebhookSecret();
    const key = parseEncryptionKey(this.config.get('SECRET_ENCRYPTION_KEY', { infer: true }));
    const secretEncrypted = encryptSecret(plaintextSecret, key);
    const graceDurationMs = this.config.get('SECRET_ROTATION_GRACE_PERIOD_MS', { infer: true });

    const subscriber = await this.subscribers.rotateSecret(
      subscriberId,
      secretEncrypted,
      graceDurationMs,
    );
    if (!subscriber) {
      return null;
    }

    return { subscriber, plaintextSecret };
  }
}
