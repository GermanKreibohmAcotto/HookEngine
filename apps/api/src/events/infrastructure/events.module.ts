import { Module } from '@nestjs/common';

import { DeliveryModule } from '../../delivery/infrastructure/delivery.module';
import { SubscribersModule } from '../../subscriptions/infrastructure/subscribers.module';
import { IngestEventUseCase } from '../application/ingest-event.use-case';
import { EVENT_REPOSITORY } from '../application/ports/event-repository.port';
import { DrizzleEventRepository } from './drizzle-event.repository';
import { EventsController } from './events.controller';

@Module({
  imports: [DeliveryModule, SubscribersModule],
  controllers: [EventsController],
  providers: [{ provide: EVENT_REPOSITORY, useClass: DrizzleEventRepository }, IngestEventUseCase],
})
export class EventsModule {}
