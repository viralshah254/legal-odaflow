import { Worker, Job } from 'bullmq';
import { NestFactory } from '@nestjs/core';
import { INestApplicationContext } from '@nestjs/common';
import { QUEUE_NAMES } from '../jobs.constants';
import { WorkerAppModule } from './worker-app.module';
import { ObligationMonitorService } from '@/platform/document-review/obligation-monitor.service';

let appContext: INestApplicationContext | null = null;

function getRedisConnectionOptions() {
  return {
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
    maxRetriesPerRequest: null,
  };
}

interface ObligationCheckPayload {
  tenantId?: string;
}

async function processObligationCheck(job: Job<ObligationCheckPayload>) {
  if (!appContext) {
    appContext = await NestFactory.createApplicationContext(WorkerAppModule, {
      logger: ['error', 'warn'],
    });
  }

  const monitorService = appContext.get(ObligationMonitorService);

  if (job.data.tenantId) {
    return monitorService.checkTenant(job.data.tenantId);
  }

  return monitorService.checkAllTenants();
}

export function createObligationCheckWorker() {
  return new Worker<ObligationCheckPayload>(
    QUEUE_NAMES.OBLIGATION_CHECK,
    processObligationCheck,
    {
      connection: getRedisConnectionOptions(),
      concurrency: 2,
    },
  );
}
