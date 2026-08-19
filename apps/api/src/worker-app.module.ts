import { Module } from '@nestjs/common';

import { DeliveryWorkerModule } from './delivery/infrastructure/delivery-worker.module';
import { ConfigModule } from './shared/config/config.module';
import { DbModule } from './shared/db/db.module';
import { RedisModule } from './shared/redis/redis.module';

@Module({
  imports: [ConfigModule, DbModule, RedisModule, DeliveryWorkerModule],
})
export class WorkerAppModule {}
