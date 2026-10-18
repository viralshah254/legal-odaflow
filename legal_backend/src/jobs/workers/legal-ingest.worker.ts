import { Worker, Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { LegalIngestJobPayload } from '../jobs.types';
import { QUEUE_NAMES, LEGAL_INGEST_JOB_TYPES } from '../jobs.constants';
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

async function processCourtListenerSync(payload: LegalIngestJobPayload) {
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
    const authorityId = result.id.startsWith('cl-') ? result.id : `cl-${result.id}`;
    const authority = await prisma.legalAuthority.upsert({
      where: {
        id: authorityId,
      },
      create: {
        id: authorityId,
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

async function processLegalIngestJob(job: Job<LegalIngestJobPayload>) {
  const payload = job.data;
  const agentJobId = payload.agentJobId;
  const jobType = payload.jobType ?? LEGAL_INGEST_JOB_TYPES.COURTLISTENER_SYNC;
  const { statuteIngest, legalSourceService, kenyaIngestOps } = await getWorkerServices();

  if (agentJobId) {
    await prisma.agentJob.update({
      where: { id: agentJobId },
      data: { status: 'RUNNING', attempts: { increment: 1 } },
    });
  }

  try {
    let result: unknown;

    if (jobType === LEGAL_INGEST_JOB_TYPES.STATUTE_SECTIONS_SEED) {
      result = await statuteIngest.seedPrioritySections(payload.countryCode);
    } else if (jobType === LEGAL_INGEST_JOB_TYPES.STATUTE_ACT_INGEST) {
      if (!payload.actId) {
        throw new Error('actId is required for STATUTE_ACT_INGEST');
      }
      result = await statuteIngest.ingestAct(payload.countryCode, payload.actId);
    } else if (jobType === LEGAL_INGEST_JOB_TYPES.TIER1_STATUTE_SYNC) {
      result = await statuteIngest.syncTier1Statutes(payload.countryCode);
    } else if (jobType === LEGAL_INGEST_JOB_TYPES.ESCR_SYNC) {
      result = await legalSourceService.syncIndiaEscrCaseLaw({
        years: payload.years,
        maxPerYear: payload.maxPerYear,
        queries: payload.queries,
        forceReindex: payload.forceReindex,
      });
    } else if (jobType === LEGAL_INGEST_JOB_TYPES.LICENSED_CASE_LAW_SYNC) {
      result = await legalSourceService.syncLicensedCaseLaw({
        practiceAreas: payload.practiceAreas,
        queries: payload.queries,
        limitPerQuery: payload.limit,
      });
    } else if (jobType === LEGAL_INGEST_JOB_TYPES.KE_MANIFEST_DISCOVERY) {
      result = await kenyaIngestOps.runManifestDiscovery({
        includeSubsidiary: payload.includeSubsidiary,
        delayMs: payload.delayMs,
      });
    } else if (jobType === LEGAL_INGEST_JOB_TYPES.KE_MANIFEST_BATCH_INGEST) {
      result = await kenyaIngestOps.runManifestBatchIngest(payload);
    } else if (jobType === LEGAL_INGEST_JOB_TYPES.KE_MANIFEST_CHANGE_SYNC) {
      result = await kenyaIngestOps.runManifestChangeSync({
        includeSubsidiary: payload.includeSubsidiary,
        delayMs: payload.delayMs,
        reingest: payload.forceReindex !== false,
      });
    } else if (jobType === LEGAL_INGEST_JOB_TYPES.KE_CASE_LAW_SYNC) {
      result = await kenyaIngestOps.runCaseLawSync(payload);
    } else if (jobType === LEGAL_INGEST_JOB_TYPES.KE_GAZETTE_DISPATCH) {
      result = await kenyaIngestOps.runGazetteDispatch();
    } else if (jobType === LEGAL_INGEST_JOB_TYPES.KE_EXTENDED_COLLECTION_DISPATCH) {
      const collection = kenyaIngestOps.parseExtendedCollection(payload.kenyaCollection);
      result = await kenyaIngestOps.runExtendedCollectionDispatch(collection);
    } else if (jobType === LEGAL_INGEST_JOB_TYPES.KE_VERIFY_COVERAGE) {
      result = await kenyaIngestOps.runVerifyCoverage();
    } else if (jobType === LEGAL_INGEST_JOB_TYPES.KE_REEMBED_ACT) {
      if (!payload.actId) {
        throw new Error('actId is required for KE_REEMBED_ACT');
      }
      result = await kenyaIngestOps.runReembedAct(payload.actId, { delayMs: payload.delayMs });
    } else {
      result = await processCourtListenerSync(payload);
    }

    if (agentJobId) {
      await prisma.agentJob.update({
        where: { id: agentJobId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          result: result as object,
        },
      });
    }

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Legal ingest failed';
    if (agentJobId) {
      await prisma.agentJob.update({
        where: { id: agentJobId },
        data: {
          status: 'FAILED',
          error: message,
          completedAt: new Date(),
        },
      });
    }
    throw error;
  }
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
