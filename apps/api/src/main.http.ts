import 'reflect-metadata';

import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { HttpAppModule } from './http-app.module';
import type { Env } from './shared/config/env.schema';
import { DomainErrorFilter } from './shared/http/domain-error.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(HttpAppModule, { bufferLogs: true });
  app.flushLogs();
  app.enableShutdownHooks();
  app.useGlobalFilters(new DomainErrorFilter());

  const config = app.get<ConfigService<Env, true>>(ConfigService);
  app.enableCors({ origin: config.get('CORS_ORIGIN', { infer: true }) });

  const port = config.get('HTTP_PORT', { infer: true });
  await app.listen(port);

  new Logger('HTTP').log(`Ingestion API listening on port ${port}`);
}

void bootstrap();
