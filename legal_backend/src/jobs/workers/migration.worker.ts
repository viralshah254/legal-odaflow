import { Worker, Job } from 'bullmq';
import { Prisma, PrismaClient } from '@prisma/client';
import { QUEUE_NAMES, MIGRATION_JOB_TYPES } from '../jobs.constants';
import type { ClioMigrationJobPayload } from '../jobs.service';

const prisma = new PrismaClient();

function getRedisConnectionOptions() {
  return {
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
    maxRetriesPerRequest: null,
  };
}

function parseCsvRows(csvContent: string): Array<Record<string, string>> {
  const lines = csvContent.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const values = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? '';
    });
    return row;
  });
}

async function processClioImport(payload: ClioMigrationJobPayload) {
  const csvContent = payload.csvContent?.trim();
  if (!csvContent) {
    throw new Error('csvContent is required for Clio import');
  }

  const rows = parseCsvRows(csvContent);
  let clientsCreated = 0;
  let mattersCreated = 0;
  const errors: string[] = [];

  for (const row of rows) {
    const type = (row.type ?? '').toLowerCase();
    const displayName = row.display_name ?? row.displayname ?? '';
    const externalId = row.id ?? '';

    try {
      if (type === 'client' || type === 'contact') {
        const existing = await prisma.client.findFirst({
          where: { tenantId: payload.tenantId, clientCode: externalId },
        });
        if (!existing && displayName) {
          await prisma.client.create({
            data: {
              tenantId: payload.tenantId,
              name: displayName,
              clientCode: externalId || `clio-${Date.now()}-${clientsCreated}`,
              type: 'INDIVIDUAL',
            },
          });
          clientsCreated += 1;
        }
      } else if (type === 'matter') {
        let clientId: string | undefined;
        const clientRef = row.client_id ?? row.clientid;
        if (clientRef) {
          const client = await prisma.client.findFirst({
            where: { tenantId: payload.tenantId, clientCode: clientRef },
          });
          clientId = client?.id;
        }
        if (!clientId) {
          const fallback = await prisma.client.findFirst({
            where: { tenantId: payload.tenantId },
            orderBy: { createdAt: 'asc' },
          });
          clientId = fallback?.id;
        }
        if (!clientId) {
          const created = await prisma.client.create({
            data: {
              tenantId: payload.tenantId,
              name: 'Imported Client',
              clientCode: `clio-import-${payload.jobId.slice(0, 8)}`,
              type: 'INDIVIDUAL',
            },
          });
          clientId = created.id;
        }
        const existingMatter = await prisma.matter.findFirst({
          where: {
            tenantId: payload.tenantId,
            title: displayName,
            clientId,
          },
        });
        if (!existingMatter && displayName) {
          await prisma.matter.create({
            data: {
              tenantId: payload.tenantId,
              clientId,
              title: displayName,
              status: 'OPEN',
              matterType: 'GENERAL',
              countryCode: 'US',
              practiceArea: 'general',
            },
          });
          mattersCreated += 1;
        }
      }
    } catch (error) {
      errors.push(
        `${type}:${displayName}: ${error instanceof Error ? error.message : 'import failed'}`,
      );
    }
  }

  return {
    jobId: payload.jobId,
    status: 'COMPLETED',
    clientsCreated,
    mattersCreated,
    rowsProcessed: rows.length,
    errors: errors.slice(0, 20),
  };
}

async function processMigrationJob(job: Job<ClioMigrationJobPayload>) {
  if (job.name !== MIGRATION_JOB_TYPES.CLIO_IMPORT) {
    throw new Error(`Unsupported migration job: ${job.name}`);
  }

  const agentJobId = job.data.agentJobId;
  if (agentJobId) {
    await prisma.agentJob.update({
      where: { id: agentJobId },
      data: { status: 'PROCESSING', attempts: { increment: 1 } },
    });
  }

  try {
    const result = await processClioImport(job.data);
    if (agentJobId) {
      await prisma.agentJob.update({
        where: { id: agentJobId },
        data: {
          status: 'COMPLETED',
          result: result as unknown as Prisma.InputJsonValue,
          completedAt: new Date(),
          error: null,
        },
      });
    }
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Clio import failed';
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

export function createMigrationWorker() {
  return new Worker<ClioMigrationJobPayload>(
    QUEUE_NAMES.MIGRATION,
    processMigrationJob,
    {
      connection: getRedisConnectionOptions(),
      concurrency: 1,
    },
  );
}
