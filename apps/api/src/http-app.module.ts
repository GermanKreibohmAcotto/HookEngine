import { Module } from '@nestjs/common';

import { DeliveriesModule } from './delivery/infrastructure/deliveries.module';
import { DlqModule } from './delivery/infrastructure/dlq.module';
import { EventsModule } from './events/infrastructure/events.module';
import { HealthModule } from './monitoring/health.module';
import { MetricsModule } from './monitoring/metrics.module';
import { StreamModule } from './monitoring/stream.module';
import { ConfigModule } from './shared/config/config.module';
import { DbModule } from './shared/db/db.module';
import { RedisModule } from './shared/redis/redis.module';
import { SubscribersModule } from './subscriptions/infrastructure/subscribers.module';

@Module({
  imports: [
    ConfigModule,
    DbModule,
    RedisModule,
    HealthModule,
    SubscribersModule,
    EventsModule,
    DlqModule,
    DeliveriesModule,
    MetricsModule,
    StreamModule,
  ],
})
export class HttpAppModule {}
