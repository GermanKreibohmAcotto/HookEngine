import { Module } from '@nestjs/common';

import { DeliveryStreamController } from './delivery-stream.controller';
import { DeliveryStreamService } from './delivery-stream.service';

@Module({
  controllers: [DeliveryStreamController],
  providers: [DeliveryStreamService],
})
export class StreamModule {}
