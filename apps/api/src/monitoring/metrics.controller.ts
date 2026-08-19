import { Controller, Get, Query, UseGuards, UsePipes } from '@nestjs/common';

import { ApiKeyGuard } from '../shared/auth/api-key.guard';
import { ZodValidationPipe } from '../shared/validation/zod-validation.pipe';
import { metricsQuerySchema, type MetricsQuery } from './dto/metrics-query.schema';
import { MetricsService, type MetricsOverview } from './metrics.service';

@Controller('api/v1/metrics')
@UseGuards(ApiKeyGuard)
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get('overview')
  @UsePipes(new ZodValidationPipe(metricsQuerySchema))
  async overview(@Query() query: MetricsQuery): Promise<MetricsOverview> {
    return this.metrics.overview(query.windowMinutes);
  }
}
