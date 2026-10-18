import { Worker, Job } from 'bullmq';
import { NestFactory } from '@nestjs/core';
import { INestApplicationContext } from '@nestjs/common';
import { QUEUE_NAMES } from '../jobs.constants';
import { WorkerAppModule } from './worker-app.module';
import { LegalUpdateIngestService } from '@/platform/continuous/legal-update-ingest.service';

let appContext: INestApplicationContext | null = null;

function getRedisConnectionOptions() {
  return {
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
    maxRetriesPerRequest: null,
  };
}

interface LegalCrawlJobPayload {
  sourceId: string;
  sourceUrl: string;
  jurisdiction: string;
  tenantId?: string;
}

async function processLegalCrawlJob(job: Job<LegalCrawlJobPayload>) {
  if (!appContext) {
    appContext = await NestFactory.createApplicationContext(WorkerAppModule, {
      logger: ['error', 'warn'],
    });
  }

  const ingestService = appContext.get(LegalUpdateIngestService);
  const result = await ingestService.ingestSource(job.data.sourceId);

  return { sourceId: job.data.sourceId, ...result };
}

export function createLegalCrawlWorker() {
  return new Worker<LegalCrawlJobPayload>(
    QUEUE_NAMES.LEGAL_CRAWL,
    processLegalCrawlJob,
    {
      connection: getRedisConnectionOptions(),
      concurrency: 3,
    },
  );
}
