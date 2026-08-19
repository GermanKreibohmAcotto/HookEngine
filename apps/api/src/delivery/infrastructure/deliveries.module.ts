import { Module } from '@nestjs/common';

import { DeliveryQueryModule } from './delivery-query.module';
import { DeliveriesController } from './deliveries.controller';

@Module({
  imports: [DeliveryQueryModule],
  controllers: [DeliveriesController],
})
export class DeliveriesModule {}
