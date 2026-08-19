import { Module } from '@nestjs/common';

import { CreateSubscriberUseCase } from '../application/create-subscriber.use-case';
import { SUBSCRIBER_REPOSITORY } from '../application/ports/subscriber-repository.port';
import { RotateSecretUseCase } from '../application/rotate-secret.use-case';
import { UpdateSubscriberUseCase } from '../application/update-subscriber.use-case';
import { DrizzleSubscriberRepository } from './drizzle-subscriber.repository';
import { SubscribersController } from './subscribers.controller';

@Module({
  controllers: [SubscribersController],
  providers: [
    { provide: SUBSCRIBER_REPOSITORY, useClass: DrizzleSubscriberRepository },
    CreateSubscriberUseCase,
    UpdateSubscriberUseCase,
    RotateSecretUseCase,
  ],
  exports: [SUBSCRIBER_REPOSITORY],
})
export class SubscribersModule {}
