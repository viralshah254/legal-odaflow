import { Worker, Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { getWorkerServices } from './worker-context';
import { SEARCH_INDEX_JOB_TYPES, QUEUE_NAMES } from '../jobs.constants';

const prisma = new PrismaClient();

export interface SearchIndexJobPayload {
  tenantId: string;
  entityType: 'matter' | 'client' | 'document' | 'task';
  entityId: string;
  action: 'upsert' | 'delete';
}

function getRedisConnectionOptions() {
  return {
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
    maxRetriesPerRequest: null,
  };
}

async function loadEntityForIndex(payload: SearchIndexJobPayload) {
  const { tenantId, entityType, entityId } = payload;

  if (entityType === 'matter') {
    const matter = await prisma.matter.findFirst({
      where: { id: entityId, tenantId },
      select: {
        id: true,
        tenantId: true,
        title: true,
        caseNumber: true,
        factsSummary: true,
        status: true,
      },
    });
    if (!matter) return null;
    return {
      id: matter.id,
      tenantId: matter.tenantId,
      entityType: 'matter' as const,
      title: matter.title,
      subtitle: matter.caseNumber,
      body: matter.factsSummary,
      matterId: matter.id,
      clientId: null,
    };
  }

  if (entityType === 'client') {
    const client = await prisma.client.findFirst({
      where: { id: entityId, tenantId },
      select: { id: true, tenantId: true, name: true, email: true, clientCode: true },
    });
    if (!client) return null;
    return {
      id: client.id,
      tenantId: client.tenantId,
      entityType: 'client' as const,
      title: client.name,
      subtitle: client.clientCode,
      body: client.email,
      matterId: null,
      clientId: client.id,
    };
  }

  if (entityType === 'document') {
    const document = await prisma.document.findFirst({
      where: { id: entityId, tenantId },
      select: {
        id: true,
        tenantId: true,
        fileName: true,
        matterId: true,
        clientId: true,
        extractedText: true,
      },
    });
    if (!document) return null;
    return {
      id: document.id,
      tenantId: document.tenantId,
      entityType: 'document' as const,
      title: document.fileName,
      subtitle: document.matterId,
      body: document.extractedText?.slice(0, 5000) ?? null,
      matterId: document.matterId,
      clientId: document.clientId,
    };
  }

  const task = await prisma.task.findFirst({
    where: { id: entityId, tenantId },
    select: { id: true, tenantId: true, title: true, status: true, matterId: true },
  });
  if (!task) return null;
  return {
    id: task.id,
    tenantId: task.tenantId,
    entityType: 'task' as const,
    title: task.title,
    subtitle: task.status,
    body: null,
    matterId: task.matterId,
    clientId: null,
  };
}

async function processSearchIndexJob(job: Job<SearchIndexJobPayload>) {
  const { openSearch } = await getWorkerServices();
  if (!openSearch?.isEnabled) {
    return { skipped: true, reason: 'OpenSearch not enabled' };
  }

  await openSearch.ensureFirmIndex();

  const payload = job.data;
  if (payload.action === 'delete') {
    await openSearch.deleteFirmEntity(payload.entityType, payload.entityId);
    return { deleted: true, entityId: payload.entityId };
  }

  const doc = await loadEntityForIndex(payload);
  if (!doc) {
    return { skipped: true, reason: 'Entity not found' };
  }

  await openSearch.indexFirmEntity(doc);
  return { indexed: true, entityId: payload.entityId, entityType: payload.entityType };
}

export function createSearchIndexWorker() {
  return new Worker<SearchIndexJobPayload>(
    QUEUE_NAMES.SEARCH_INDEX,
    async (job) => {
      if (
        job.name !== SEARCH_INDEX_JOB_TYPES.UPSERT &&
        job.name !== SEARCH_INDEX_JOB_TYPES.DELETE
      ) {
        throw new Error(`Unsupported search index job: ${job.name}`);
      }
      return processSearchIndexJob(job);
    },
    {
      connection: getRedisConnectionOptions(),
      concurrency: 2,
    },
  );
}
