import { Worker, Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { AI_JOB_TYPES } from '../jobs.constants';
import { AiAgentJobPayload } from '../jobs.types';
import { QUEUE_NAMES } from '../jobs.constants';
import { getWorkerServices } from './worker-context';

const prisma = new PrismaClient();

function getRedisConnectionOptions() {
  return {
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
    maxRetriesPerRequest: null,
  };
}

async function processResearchJob(job: Job<AiAgentJobPayload>) {
  const payload = job.data;
  const query = String(payload.params.query ?? payload.params.message ?? '');
  const countryCode = String(payload.params.countryCode ?? 'US');
  const jurisdiction =
    payload.params.jurisdiction !== undefined
      ? String(payload.params.jurisdiction)
      : undefined;

  await prisma.agentJob.update({
    where: { id: payload.agentJobId },
    data: { status: 'PROCESSING', attempts: { increment: 1 } },
  });

  const { aiGateway, automationEngine } = await getWorkerServices();

  let research;
  if (payload.jobType === AI_JOB_TYPES.OPPONENT_ANALYZER) {
    research = await aiGateway.runOpponentAnalysis({
      userId: payload.userId,
      tenantId: payload.tenantId,
      matterId: payload.params.matterId as string | undefined,
      filingText: String(payload.params.filingText ?? query),
    });
  } else {
    research = await aiGateway.runLawyerLegalResearch({
      userId: payload.userId,
      tenantId: payload.tenantId,
      matterId: payload.params.matterId as string | undefined,
      countryCode,
      jurisdiction,
      query,
    });
  }

  const citations =
    'citations' in research && research.citations != null
      ? research.citations
      : [];

  const result = {
    toolName: payload.toolName,
    outputMarkdown: research.outputMarkdown,
    citations,
    countryCode,
    matterId: payload.params.matterId,
    provider: research.provider,
    modelName: research.modelName,
  };

  await prisma.agentJob.update({
    where: { id: payload.agentJobId },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
      result: result as object,
    },
  });

  if (payload.sessionId) {
    await prisma.copilotMessage.create({
      data: {
        sessionId: payload.sessionId,
        role: 'assistant',
        content: research.outputMarkdown,
        citations: citations as object[],
      },
    });
  }

  try {
    await automationEngine.dispatch(payload.tenantId, 'agent.completed', {
      agentJobId: payload.agentJobId,
      jobType: payload.jobType,
      toolName: payload.toolName,
      userId: payload.userId,
      matterId: payload.params.matterId,
      status: 'COMPLETED',
    });
  } catch {
    // Automation dispatch should not fail the completed AI job.
  }

  return result;
}

export function createResearchWorker() {
  return new Worker<AiAgentJobPayload>(
    QUEUE_NAMES.AI_HIGH,
    processResearchJob,
    {
      connection: getRedisConnectionOptions(),
      concurrency: 2,
    },
  );
}
