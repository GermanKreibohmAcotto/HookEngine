import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from '../../shared/config/env.schema';
import type { Subscriber } from '../domain/subscriber';
import { assertSafeTargetUrl } from '../domain/target-url';
import { encryptSecret, generateWebhookSecret, parseEncryptionKey } from '../domain/webhook-secret';
import {
  SUBSCRIBER_REPOSITORY,
  type SubscriberRepository,
} from './ports/subscriber-repository.port';

export interface CreateSubscriberInput {
  readonly name: string;
  readonly targetUrl: string;
  readonly eventTypes: readonly string[];
  readonly timeoutMs?: number | undefined;
  readonly maxRetries?: number | undefined;
  readonly rateLimitPerSec?: number | undefined;
}

export interface CreateSubscriberResult {
  readonly subscriber: Subscriber;
  /** Shown to the caller exactly once — never persisted or returned again in plaintext. */
  readonly plaintextSecret: string;
}

@Injectable()
export class CreateSubscriberUseCase {
  constructor(
    @Inject(SUBSCRIBER_REPOSITORY) private readonly subscribers: SubscriberRepository,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async execute(input: CreateSubscriberInput): Promise<CreateSubscriberResult> {
    await assertSafeTargetUrl(input.targetUrl);

    const plaintextSecret = generateWebhookSecret();
    const key = parseEncryptionKey(this.config.get('SECRET_ENCRYPTION_KEY', { infer: true }));
    const secretEncrypted = encryptSecret(plaintextSecret, key);

    const subscriber = await this.subscribers.create({
      name: input.name,
      targetUrl: input.targetUrl,
      secretEncrypted,
      eventTypes: input.eventTypes,
      timeoutMs: input.timeoutMs,
      maxRetries: input.maxRetries,
      rateLimitPerSec: input.rateLimitPerSec,
    });

    return { subscriber, plaintextSecret };
  }
}
