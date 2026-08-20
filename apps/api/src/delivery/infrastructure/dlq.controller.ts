import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
  UseGuards,
  UsePipes,
} from '@nestjs/common';

import { ApiKeyGuard } from '../../shared/auth/api-key.guard';
import { notFoundError } from '../../shared/http/error-codes';
import { ZodValidationPipe } from '../../shared/validation/zod-validation.pipe';
import type { BulkRetryResult } from '../application/retry-dead-letter.use-case';
import { RetryDeadLetterUseCase } from '../application/retry-dead-letter.use-case';
import {
  DELIVERY_REPOSITORY,
  type DeliveryRepository,
} from '../application/ports/delivery-repository.port';
import { toDeliverySummary } from './delivery-summary.mapper';
import {
  bulkRetrySchema,
  type BulkRetryDto,
  listDlqQuerySchema,
  type ListDlqQuery,
} from './dto/dlq.schemas';

@Controller('api/v1/dlq')
@UseGuards(ApiKeyGuard)
export class DlqController {
  constructor(
    @Inject(DELIVERY_REPOSITORY) private readonly deliveries: DeliveryRepository,
    private readonly retryDeadLetter: RetryDeadLetterUseCase,
  ) {}

  @Get()
  @UsePipes(new ZodValidationPipe(listDlqQuerySchema))
  async list(@Query() query: ListDlqQuery) {
    const { items, total } = await this.deliveries.listDead({
      limit: query.limit,
      offset: query.offset,
    });

    return {
      items: items.map(toDeliverySummary),
      total,
      limit: query.limit,
      offset: query.offset,
    };
  }

  @Post(':id/retry')
  async retry(@Param('id') id: string): Promise<{ retried: true }> {
    const retried = await this.retryDeadLetter.execute(id);
    if (!retried) {
      throw notFoundError(`No dead delivery ${id} found`, 'DEAD_DELIVERY_NOT_FOUND');
    }
    return { retried: true };
  }

  @Post('bulk-retry')
  @UsePipes(new ZodValidationPipe(bulkRetrySchema))
  async bulkRetry(@Body() dto: BulkRetryDto): Promise<BulkRetryResult> {
    return this.retryDeadLetter.executeBulk(dto.deliveryIds);
  }
}
