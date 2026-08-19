import 'reflect-metadata';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { WorkerAppModule } from './worker-app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(WorkerAppModule, {
    bufferLogs: true,
  });
  app.flushLogs();
  app.enableShutdownHooks();

  new Logger('Worker').log('Delivery worker started');
}

void bootstrap();
