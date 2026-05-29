import { Worker, Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { LegalIngestJobPayload } from '../jobs.types';
import { QUEUE_NAMES } from '../jobs.constants';
import { getWorkerServices } from './worker-context';

const prisma = new PrismaClient();

function getRedisConnectionOptions() {
  return {
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
    maxRetriesPerRequest: null,
  };
}

function chunkText(text: string, chunkSize = 1200): string[] {
  const normalized = text.trim();
  if (!normalized) {
    return [];
  }

  const chunks: string[] = [];
  for (let index = 0; index < normalized.length; index += chunkSize) {
    chunks.push(normalized.slice(index, index + chunkSize));
  }
  return chunks;
}

async function processLegalIngestJob(job: Job<LegalIngestJobPayload>) {
  const payload = job.data;
  const { courtListener, embeddingService } = await getWorkerServices();
  const countryCode = payload.countryCode.toUpperCase();
  const query = payload.query ?? 'contract dispute';
  const results = await courtListener.search({
    query,
    jurisdiction: payload.jurisdiction,
    limit: payload.limit ?? 5,
  });

  let authorityCount = 0;
  let chunkCount = 0;

  for (const result of results) {
    const authority = await prisma.legalAuthority.upsert({
      where: {
        id: `courtlistener-${result.id}`,
      },
      create: {
        id: `courtlistener-${result.id}`,
        countryCode,
        title: result.title,
        citation: result.citation,
        sourceName: 'CourtListener',
        sourceUrl: result.sourceUrl,
        summary: result.summary,
        jurisdiction: result.court,
        authorityType: 'CASE_LAW',
        embeddingStatus: 'PENDING',
        topics: [],
        practiceAreas: [],
      },
      update: {
        title: result.title,
        citation: result.citation,
        summary: result.summary,
        sourceUrl: result.sourceUrl,
        jurisdiction: result.court,
      },
    });
    authorityCount += 1;

    const textParts = chunkText(
      [result.title, result.summary ?? '', result.citation ?? ''].filter(Boolean).join('\n'),
    );
    const stored = await embeddingService.storeChunks(
      textParts.map((content, chunkIndex) => ({
        sourceType: 'LEGAL_AUTHORITY',
        sourceId: authority.id,
        chunkIndex,
        content,
        countryCode,
        jurisdiction: result.court ?? undefined,
        modelName: embeddingService.getEmbeddingModel(),
      })),
    );
    chunkCount += stored.stored;

    await prisma.legalAuthority.update({
      where: { id: authority.id },
      data: { embeddingStatus: stored.stored > 0 ? 'COMPLETED' : 'PENDING' },
    });
  }

  await prisma.legalSource.updateMany({
    where: { countryCode, name: 'CourtListener' },
    data: {
      lastSyncedAt: new Date(),
      chunkCount: { increment: chunkCount },
    },
  });

  return {
    countryCode,
    authorityCount,
    chunkCount,
    connectorConfigured: courtListener.isConfigured(),
  };
}

export function createLegalIngestWorker() {
  return new Worker<LegalIngestJobPayload>(
    QUEUE_NAMES.LEGAL_INGEST,
    processLegalIngestJob,
    {
      connection: getRedisConnectionOptions(),
      concurrency: 1,
    },
  );
}
