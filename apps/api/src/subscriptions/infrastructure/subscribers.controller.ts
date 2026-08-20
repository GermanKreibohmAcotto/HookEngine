import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  UseGuards,
  UsePipes,
} from '@nestjs/common';

import { ApiKeyGuard } from '../../shared/auth/api-key.guard';
import { notFoundError } from '../../shared/http/error-codes';
import { ZodValidationPipe } from '../../shared/validation/zod-validation.pipe';
import { CreateSubscriberUseCase } from '../application/create-subscriber.use-case';
import {
  SUBSCRIBER_REPOSITORY,
  type SubscriberRepository,
} from '../application/ports/subscriber-repository.port';
import { RotateSecretUseCase } from '../application/rotate-secret.use-case';
import { UpdateSubscriberUseCase } from '../application/update-subscriber.use-case';
import type { Subscriber } from '../domain/subscriber';
import {
  type CreateSubscriberDto,
  createSubscriberSchema,
  type UpdateSubscriberDto,
  updateSubscriberSchema,
} from './dto/subscriber.schemas';

type PublicSubscriber = Omit<Subscriber, 'secretEncrypted' | 'previousSecretEncrypted'>;

function toPublic(subscriber: Subscriber): PublicSubscriber {
  const {
    secretEncrypted: _secretEncrypted,
    previousSecretEncrypted: _previous,
    ...rest
  } = subscriber;
  return rest;
}

@Controller('api/v1/subscribers')
@UseGuards(ApiKeyGuard)
export class SubscribersController {
  constructor(
    @Inject(SUBSCRIBER_REPOSITORY) private readonly subscribers: SubscriberRepository,
    private readonly createSubscriber: CreateSubscriberUseCase,
    private readonly updateSubscriber: UpdateSubscriberUseCase,
    private readonly rotateSecret: RotateSecretUseCase,
  ) {}

  @Post()
  @UsePipes(new ZodValidationPipe(createSubscriberSchema))
  async create(@Body() dto: CreateSubscriberDto): Promise<PublicSubscriber & { secret: string }> {
    const { subscriber, plaintextSecret } = await this.createSubscriber.execute(dto);
    return { ...toPublic(subscriber), secret: plaintextSecret };
  }

  @Get()
  async list(): Promise<PublicSubscriber[]> {
    const all = await this.subscribers.list();
    return all.map(toPublic);
  }

  @Get(':id')
  async get(@Param('id') id: string): Promise<PublicSubscriber> {
    const subscriber = await this.subscribers.findById(id);
    if (!subscriber) {
      throw notFoundError(`Subscriber ${id} not found`, 'SUBSCRIBER_NOT_FOUND');
    }
    return toPublic(subscriber);
  }

  @Patch(':id')
  @UsePipes(new ZodValidationPipe(updateSubscriberSchema))
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateSubscriberDto,
  ): Promise<PublicSubscriber> {
    const subscriber = await this.updateSubscriber.execute(id, dto);
    if (!subscriber) {
      throw notFoundError(`Subscriber ${id} not found`, 'SUBSCRIBER_NOT_FOUND');
    }
    return toPublic(subscriber);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string): Promise<void> {
    const deleted = await this.subscribers.delete(id);
    if (!deleted) {
      throw notFoundError(`Subscriber ${id} not found`, 'SUBSCRIBER_NOT_FOUND');
    }
  }

  @Post(':id/rotate-secret')
  async rotate(@Param('id') id: string): Promise<PublicSubscriber & { secret: string }> {
    const result = await this.rotateSecret.execute(id);
    if (!result) {
      throw notFoundError(`Subscriber ${id} not found`, 'SUBSCRIBER_NOT_FOUND');
    }
    return { ...toPublic(result.subscriber), secret: result.plaintextSecret };
  }
}
