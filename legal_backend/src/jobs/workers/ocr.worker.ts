import { Worker, Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { OcrJobPayload } from '../jobs.service';
import { getWorkerServices } from './worker-context';

const prisma = new PrismaClient();

function getRedisConnectionOptions() {
  return {
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
    maxRetriesPerRequest: null,
  };
}

async function processOcrJob(job: Job<OcrJobPayload>) {
  const payload = job.data;
  const { azureOcr } = await getWorkerServices();

  const agentJob = await prisma.agentJob.findFirst({
    where: {
      queue: 'ocr-processing',
      userId: payload.userId,
      status: 'QUEUED',
    },
    orderBy: { createdAt: 'desc' },
  });

  if (agentJob) {
    await prisma.agentJob.update({
      where: { id: agentJob.id },
      data: {
        status: 'PROCESSING',
        attempts: { increment: 1 },
      },
    });
  }

  const extractedText = await azureOcr.extractTextFromUrl(payload.fileUrl);

  if (payload.scope === 'CONSUMER') {
    await prisma.consumerDocument.update({
      where: { id: payload.documentId },
      data: {
        extractedText,
        ocrStatus: 'COMPLETED',
      },
    });
  } else {
    await prisma.document.update({
      where: { id: payload.documentId },
      data: {
        mimeType: 'text/plain',
      },
    });
  }

  if (agentJob) {
    await prisma.agentJob.update({
      where: { id: agentJob.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        result: { extractedText, documentId: payload.documentId },
      },
    });
  }

  return { extractedText, documentId: payload.documentId };
}

export function createOcrWorker() {
  return new Worker<OcrJobPayload>('ocr-processing', processOcrJob, {
    connection: getRedisConnectionOptions(),
    concurrency: 2,
  });
}
