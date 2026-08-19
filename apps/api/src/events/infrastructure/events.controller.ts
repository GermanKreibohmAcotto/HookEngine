import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpStatus,
  Post,
  Res,
  UseGuards,
  UsePipes,
} from '@nestjs/common';

import { ApiKeyGuard } from '../../shared/auth/api-key.guard';
import { ZodValidationPipe } from '../../shared/validation/zod-validation.pipe';
import { IngestEventUseCase } from '../application/ingest-event.use-case';
import { type CreateEventDto, createEventSchema } from './dto/create-event.schema';

interface MinimalResponse {
  status(code: number): { json(body: unknown): void };
}

@Controller('api/v1/events')
@UseGuards(ApiKeyGuard)
export class EventsController {
  constructor(private readonly ingestEvent: IngestEventUseCase) {}

  @Post()
  @UsePipes(new ZodValidationPipe(createEventSchema))
  async create(
    @Body() dto: CreateEventDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Res() res: MinimalResponse,
  ): Promise<void> {
    if (!idempotencyKey) {
      throw new BadRequestException('Idempotency-Key header is required');
    }

    // Same key, same payload, retried by a client that never saw the first
    // response: not an error, just hand back what already happened.
    const result = await this.ingestEvent.execute({
      eventType: dto.eventType,
      payload: dto.payload,
      idempotencyKey,
    });

    const body = {
      id: result.event.id,
      eventType: result.event.eventType,
      idempotencyKey: result.event.idempotencyKey,
      occurredAt: result.event.occurredAt,
      deliveriesQueued: result.deliveries.length,
    };

    res.status(result.alreadyIngested ? HttpStatus.OK : HttpStatus.ACCEPTED).json(body);
  }
}
