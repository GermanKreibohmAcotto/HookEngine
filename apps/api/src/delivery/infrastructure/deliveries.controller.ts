import { Controller, Get, Inject, Param, Query, UseGuards, UsePipes } from '@nestjs/common';

import { ApiKeyGuard } from '../../shared/auth/api-key.guard';
import { notFoundError } from '../../shared/http/error-codes';
import { ZodValidationPipe } from '../../shared/validation/zod-validation.pipe';
import {
  DELIVERY_REPOSITORY,
  type DeliveryRepository,
} from '../application/ports/delivery-repository.port';
import { toDeliverySummary } from './delivery-summary.mapper';
import { listDeliveriesQuerySchema, type ListDeliveriesQuery } from './dto/list-deliveries.schema';

@Controller('api/v1/deliveries')
@UseGuards(ApiKeyGuard)
export class DeliveriesController {
  constructor(@Inject(DELIVERY_REPOSITORY) private readonly deliveries: DeliveryRepository) {}

  @Get()
  @UsePipes(new ZodValidationPipe(listDeliveriesQuerySchema))
  async list(@Query() query: ListDeliveriesQuery) {
    const { items, total } = await this.deliveries.list(
      { status: query.status, subscriberId: query.subscriberId },
      { limit: query.limit, offset: query.offset },
    );

    return {
      items: items.map(toDeliverySummary),
      total,
      limit: query.limit,
      offset: query.offset,
    };
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    const result = await this.deliveries.getWithAttempts(id);
    if (!result) {
      throw notFoundError(`Delivery ${id} not found`, 'DELIVERY_NOT_FOUND');
    }

    return {
      ...toDeliverySummary(result),
      attempts: result.attempts.map((attempt) => ({
        id: attempt.id,
        attemptNumber: attempt.attemptNumber,
        requestHeaders: attempt.requestHeaders,
        responseStatus: attempt.responseStatus,
        responseBodyTruncated: attempt.responseBodyTruncated,
        latencyMs: attempt.latencyMs,
        errorMessage: attempt.errorMessage,
        attemptedAt: attempt.attemptedAt,
      })),
    };
  }
}
