import { Worker, Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { AnonymizationJobPayload } from '../jobs.types';
import { QUEUE_NAMES } from '../jobs.constants';

const prisma = new PrismaClient();

const PII_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: 'EMAIL', pattern: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi },
  { label: 'PHONE', pattern: /\+?\d[\d\s().-]{7,}\d/g },
  { label: 'SSN', pattern: /\b\d{3}-\d{2}-\d{4}\b/g },
];

function getRedisConnectionOptions() {
  return {
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
    maxRetriesPerRequest: null,
  };
}

function redactText(input: string) {
  const redactionMap: Record<string, string> = {};
  let output = input;
  let counter = 1;

  for (const entry of PII_PATTERNS) {
    output = output.replace(entry.pattern, (match) => {
      const token = `[${entry.label}_${counter}]`;
      redactionMap[token] = match;
      counter += 1;
      return token;
    });
  }

  return {
    output,
    redactionMap,
    piiDetected: Object.keys(redactionMap).length > 0,
  };
}

async function loadSourceText(sourceType: string, sourceId: string): Promise<string> {
  if (sourceType === 'DOCUMENT') {
    const document = await prisma.document.findUnique({ where: { id: sourceId } });
    return document?.fileName ?? '';
  }

  const consumerDocument = await prisma.consumerDocument.findUnique({
    where: { id: sourceId },
  });
  return consumerDocument?.extractedText ?? consumerDocument?.fileName ?? '';
}

async function processAnonymizationJob(job: Job<AnonymizationJobPayload>) {
  const payload = job.data;

  await prisma.anonymizationJob.update({
    where: { id: payload.anonymizationJobId },
    data: { status: 'PROCESSING' },
  });

  try {
    const sourceText = await loadSourceText(payload.sourceType, payload.sourceId);
    const { output, redactionMap, piiDetected } = redactText(sourceText);

    await prisma.anonymizationJob.update({
      where: { id: payload.anonymizationJobId },
      data: {
        status: 'COMPLETED',
        outputText: output,
        piiDetected: { detected: piiDetected, tokenCount: Object.keys(redactionMap).length },
        redactionMap,
        completedAt: new Date(),
      },
    });

    await prisma.documentTrainingPermission.updateMany({
      where: { documentId: payload.sourceId },
      data: {
        anonymizationStatus: 'COMPLETED',
        redactionStatus: piiDetected ? 'REDACTED' : 'NOT_REQUIRED',
      },
    });

    return { anonymizationJobId: payload.anonymizationJobId, piiDetected };
  } catch (error) {
    await prisma.anonymizationJob.update({
      where: { id: payload.anonymizationJobId },
      data: {
        status: 'FAILED',
        error: error instanceof Error ? error.message : 'Anonymization failed',
        completedAt: new Date(),
      },
    });
    throw error;
  }
}

export function createAnonymizationWorker() {
  return new Worker<AnonymizationJobPayload>(
    QUEUE_NAMES.ANONYMIZATION,
    processAnonymizationJob,
    {
      connection: getRedisConnectionOptions(),
      concurrency: 2,
    },
  );
}
