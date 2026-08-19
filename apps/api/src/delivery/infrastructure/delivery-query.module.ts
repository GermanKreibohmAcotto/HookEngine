import { Module } from '@nestjs/common';

import { DELIVERY_REPOSITORY } from '../application/ports/delivery-repository.port';
import { DrizzleDeliveryRepository } from './drizzle-delivery.repository';

/** The read side of delivery data, shared by DlqModule and DeliveriesModule so each doesn't redeclare its own provider. */
@Module({
  providers: [{ provide: DELIVERY_REPOSITORY, useClass: DrizzleDeliveryRepository }],
  exports: [DELIVERY_REPOSITORY],
})
export class DeliveryQueryModule {}
