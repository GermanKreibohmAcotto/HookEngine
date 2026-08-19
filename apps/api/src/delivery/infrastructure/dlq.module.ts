import { Module } from '@nestjs/common';

import { RetryDeadLetterUseCase } from '../application/retry-dead-letter.use-case';
import { DeliveryModule } from './delivery.module';
import { DeliveryQueryModule } from './delivery-query.module';
import { DlqController } from './dlq.controller';

@Module({
  imports: [DeliveryModule, DeliveryQueryModule],
  controllers: [DlqController],
  providers: [RetryDeadLetterUseCase],
})
export class DlqModule {}
