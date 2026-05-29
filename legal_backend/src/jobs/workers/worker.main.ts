import { Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { logger } from '../../common/observability/logger';
import { initSentry, Sentry } from '../../common/observability/sentry';

initSentry('legal-backend-worker');
import { createAnonymizationWorker } from './anonymization.worker';
import { createAutomationWorker } from './automation.worker';
import { createLegalIngestWorker } from './legal-ingest.worker';
import { createNotifyWorker } from './notify.worker';
import { createOcrWorker } from './ocr.worker';
import { createResearchWorker } from './research.worker';
import { createSummaryWorker } from './summary.worker';
import { closeWorkerServices } from './worker-context';
import { QUEUE_NAMES } from '../jobs.constants';

const prisma = new PrismaClient();

async function markAgentJobFailed(job: Job | undefined, error: Error) {
  const payload = job?.data as { agentJobId?: string } | undefined;
  if (!payload?.agentJobId) {
    return;
  }

  await prisma.agentJob.update({
    where: { id: payload.agentJobId },
    data: {
      status: 'FAILED',
      error: error.message,
      completedAt: new Date(),
    },
  });
}

async function bootstrap() {
  const workers = [
    { name: QUEUE_NAMES.OCR, worker: createOcrWorker() },
    { name: QUEUE_NAMES.AI_HIGH, worker: createResearchWorker() },
    { name: QUEUE_NAMES.AI_LOW, worker: createSummaryWorker() },
    { name: QUEUE_NAMES.NOTIFICATIONS, worker: createNotifyWorker() },
    { name: QUEUE_NAMES.AUTOMATIONS, worker: createAutomationWorker() },
    { name: QUEUE_NAMES.ANONYMIZATION, worker: createAnonymizationWorker() },
    { name: QUEUE_NAMES.LEGAL_INGEST, worker: createLegalIngestWorker() },
  ];

  for (const entry of workers) {
    entry.worker.on('completed', (job: Job) => {
      console.log(`[${entry.name}] job ${job.id} completed`);
    });

    entry.worker.on('failed', (job: Job | undefined, error: Error) => {
      logger.error('Worker job failed', {
        queue: entry.name,
        jobId: job?.id,
        jobName: job?.name,
        error: error.message,
        stack: error.stack,
      });
      Sentry.captureException(error, {
        tags: { queue: entry.name },
        extra: { jobId: job?.id, jobName: job?.name },
      });
      void markAgentJobFailed(job, error);
    });

    console.log(`Worker listening: ${entry.name}`);
  }

  const shutdown = async () => {
    await Promise.all(workers.map((entry) => entry.worker.close()));
    await closeWorkerServices();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap().catch((error: unknown) => {
  const err = error instanceof Error ? error : new Error(String(error));
  logger.error('Worker bootstrap failed', {
    error: err.message,
    stack: err.stack,
  });
  Sentry.captureException(err);
  process.exit(1);
});
