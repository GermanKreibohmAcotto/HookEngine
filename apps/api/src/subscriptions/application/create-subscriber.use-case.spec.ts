import type { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'vitest';

import type { Env } from '../../shared/config/env.schema';
import type { SubscriberRepository } from './ports/subscriber-repository.port';
import { CreateSubscriberUseCase } from './create-subscriber.use-case';
import type { NewSubscriber, Subscriber } from '../domain/subscriber';
import { UnsafeTargetUrlError } from '../domain/target-url';

class FakeSubscriberRepository implements SubscriberRepository {
  created: NewSubscriber[] = [];

  async create(subscriber: NewSubscriber): Promise<Subscriber> {
    this.created.push(subscriber);
    return {
      id: 'sub_1',
      name: subscriber.name,
      targetUrl: subscriber.targetUrl,
      secretEncrypted: subscriber.secretEncrypted,
      previousSecretEncrypted: null,
      previousSecretExpiresAt: null,
      eventTypes: subscriber.eventTypes,
      isActive: true,
      timeoutMs: subscriber.timeoutMs ?? 10_000,
      maxRetries: subscriber.maxRetries ?? 8,
      rateLimitPerSec: subscriber.rateLimitPerSec ?? 5,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  async findById(): Promise<Subscriber | null> {
    return null;
  }

  async findActiveByEventType(): Promise<Subscriber[]> {
    return [];
  }

  async list(): Promise<Subscriber[]> {
    return [];
  }

  async update(): Promise<Subscriber | null> {
    return null;
  }

  async delete(): Promise<boolean> {
    return false;
  }

  async rotateSecret(): Promise<Subscriber | null> {
    return null;
  }
}

function fakeConfig(): ConfigService<Env, true> {
  return { get: () => '00'.repeat(32) } as unknown as ConfigService<Env, true>;
}

describe('CreateSubscriberUseCase', () => {
  it('encrypts the secret before persisting and returns the plaintext once', async () => {
    const repository = new FakeSubscriberRepository();
    const useCase = new CreateSubscriberUseCase(repository, fakeConfig());

    const result = await useCase.execute({
      name: 'Test subscriber',
      targetUrl: 'https://8.8.8.8/hook',
      eventTypes: ['order.created'],
    });

    expect(result.plaintextSecret).toMatch(/^whsec_/);
    expect(repository.created[0]?.secretEncrypted).toBeDefined();
    expect(repository.created[0]?.secretEncrypted).not.toContain(result.plaintextSecret);
    expect(result.subscriber.secretEncrypted).not.toBe(result.plaintextSecret);
  });

  it('rejects a subscriber pointed at a private address before touching the repository', async () => {
    const repository = new FakeSubscriberRepository();
    const useCase = new CreateSubscriberUseCase(repository, fakeConfig());

    await expect(
      useCase.execute({
        name: 'Malicious subscriber',
        targetUrl: 'http://127.0.0.1/hook',
        eventTypes: ['order.created'],
      }),
    ).rejects.toThrow(UnsafeTargetUrlError);

    expect(repository.created).toHaveLength(0);
  });
});
