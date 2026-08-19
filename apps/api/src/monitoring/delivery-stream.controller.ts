import { Controller, Sse, UseGuards, type MessageEvent } from '@nestjs/common';
import type { Observable } from 'rxjs';

import { SseApiKeyGuard } from '../shared/auth/sse-api-key.guard';
import { DeliveryStreamService } from './delivery-stream.service';

@Controller('api/v1/stream')
@UseGuards(SseApiKeyGuard)
export class DeliveryStreamController {
  constructor(private readonly deliveryStream: DeliveryStreamService) {}

  @Sse('deliveries')
  deliveries(): Observable<MessageEvent> {
    return this.deliveryStream.stream();
  }
}
