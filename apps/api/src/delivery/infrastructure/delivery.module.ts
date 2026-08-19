import { Module } from '@nestjs/common';

import { DELIVERY_QUEUE } from '../application/ports/delivery-queue.port';
import { BullmqDeliveryQueue } from './bullmq-delivery-queue.adapter';

@Module({
  providers: [{ provide: DELIVERY_QUEUE, useClass: BullmqDeliveryQueue }],
  exports: [DELIVERY_QUEUE],
})
export class DeliveryModule {}
