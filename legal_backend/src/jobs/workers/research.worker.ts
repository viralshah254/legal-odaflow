import { Worker, Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { AI_JOB_TYPES } from '../jobs.constants';
import { AiAgentJobPayload } from '../jobs.types';
import { QUEUE_NAMES } from '../jobs.constants';
import { getWorkerServices } from './worker-context';
import type { LawyerResearchResult } from '@/ai/ai-gateway.service';
import { serializeResearchJobResult } from './research-result.serializer';
import {
  RESEARCH_LOCK_DURATION_MS,
  RESEARCH_MAX_STALLED_COUNT,
  RESEARCH_STALLED_INTERVAL_MS,
} from '../research-queue.policy';
import {
  buildFallbackResearchMemo,
  isResearchStallOrTimeoutError,
} from '@/ai/legal-research/research-mode';

const prisma = new PrismaClient();

function getRedisConnectionOptions() {
  return {
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
    maxRetriesPerRequest: null,
  };
}

async function processResearchJob(job: Job<AiAgentJobPayload>) {
  const workerStartedAt = Date.now();
  const queueWaitMs = Math.max(0, workerStartedAt - job.timestamp);
  const payload = job.data;
  const params = payload.params ?? {};
  const query = String(params.query ?? params.message ?? '');

  await prisma.agentJob.update({
    where: { id: payload.agentJobId },
    data: { status: 'PROCESSING', attempts: { increment: 1 } },
  });

  const { aiGateway, automationEngine, legalLocation, artifactAccess } = await getWorkerServices();
  const currentActor = await artifactAccess.assertActiveMember({ tenantId: payload.tenantId, userId: payload.userId });

  const resolvedLocation = params.countryCode
    ? {
        countryCode: String(params.countryCode),
        jurisdiction:
          params.jurisdiction !== undefined ? String(params.jurisdiction) : undefined,
      }
    : await legalLocation.resolve({
        userId: payload.userId,
        tenantId: payload.tenantId,
        matterId: params.matterId as string | undefined,
        requestJurisdiction:
          params.jurisdiction !== undefined ? String(params.jurisdiction) : undefined,
      });

  const countryCode = resolvedLocation.countryCode;
  const jurisdiction = resolvedLocation.jurisdiction;

  let result: Record<string, unknown>;

  if (payload.jobType === AI_JOB_TYPES.OPPONENT_ANALYZER) {
    const analysis = await aiGateway.runOpponentAnalysis({
      userId: payload.userId,
      tenantId: payload.tenantId,
      matterId: params.matterId as string | undefined,
      filingText: String(params.filingText ?? query),
    });
    const citations =
      'citations' in analysis && analysis.citations != null ? analysis.citations : [];
    result = {
      toolName: payload.toolName,
      phase: 'completed',
      query,
      outputMarkdown: analysis.outputMarkdown,
      draftMarkdown: analysis.outputMarkdown,
      citations,
      countryCode,
      jurisdiction,
      matterId: params.matterId,
      provider: analysis.provider,
      modelName: analysis.modelName,
    };
  } else {
    let research: LawyerResearchResult;
    try {
      research = await aiGateway.runLawyerLegalResearch({
        userId: payload.userId,
        tenantId: payload.tenantId,
        tenantRole: currentActor.tenantRole,
        matterId: params.matterId as string | undefined,
        selectedDocumentIds: params.selectedDocumentIds as string[] | undefined,
        selectedSavedResearchIds: params.selectedSavedResearchIds as string[] | undefined,
        contextScope: params.contextScope as 'SELECTED' | 'MATTER' | 'FOLDERS' | undefined,
        selectedFolderIds: params.selectedFolderIds as string[] | undefined,
        countryCode,
        jurisdiction,
        practiceArea: params.practiceArea as string | undefined,
        query,
        aiModelMode: params.aiModelMode as 'AUTO' | 'PREMIUM' | undefined,
        premiumModelId: params.premiumModelId as string | undefined,
        researchMode: params.researchMode as 'FAST' | 'DEEP' | 'GUIDANCE' | undefined,
        locale: params.locale as string | undefined,
        priorContext: params.priorContext as string | undefined,
        knowledgeSources: params.knowledgeSources as string[] | undefined,
        asOfDate: params.asOfDate as string | undefined,
        eventDate: params.eventDate as string | undefined,
        desiredOutput: params.desiredOutput as
          | 'ANSWER'
          | 'AUTHORITY_LIST'
          | 'ANALYSIS'
          | 'MEMO'
          | 'VERIFICATION'
          | undefined,
        requestedTaskKind: params.requestedTaskKind as
          | import('@/ai/legal-research/research-planning.types').ResearchTaskKind
          | undefined,
        agentJobId: payload.agentJobId,
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(
        `[research] failed for user=${payload.userId} tenant=${payload.tenantId} job=${payload.agentJobId} mode=${String(params.researchMode ?? 'DEEP')} error=${errMsg}`,
      );
      if (isResearchStallOrTimeoutError(err)) {
        research = {
          outputMarkdown: buildFallbackResearchMemo({
            query,
            countryCode,
            jurisdiction,
            researchMode: String(params.researchMode ?? 'DEEP'),
            reason: errMsg,
          }),
          citations: [],
          mode: 'LAWYER_LEGAL_RESEARCH',
          provider: 'fallback',
          modelName: 'fallback',
          countryCode,
          jurisdiction,
          researchMode: params.researchMode as LawyerResearchResult['researchMode'],
          degraded: true,
          requiresLawyerReview: true,
        };
      } else {
        throw err;
      }
    }

    result = serializeResearchJobResult(research, {
      toolName: payload.toolName,
      query,
      countryCode,
      jurisdiction,
      matterId: params.matterId,
      queueWaitMs,
      requestedTaskKind: params.requestedTaskKind as string | undefined,
    });
  }

  const outputMarkdown = String(result.outputMarkdown ?? '');
  result.workerProcessingMs = Date.now() - workerStartedAt;

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
        content: outputMarkdown,
        citations: (result.citations as object[]) ?? [],
      },
    });
  }

  try {
    await automationEngine.dispatch(payload.tenantId, 'agent.completed', {
      agentJobId: payload.agentJobId,
      jobType: payload.jobType,
      toolName: payload.toolName,
      userId: payload.userId,
      matterId: params.matterId,
      status: 'COMPLETED',
    });
  } catch {
    // Automation dispatch should not fail the completed AI job.
  }

  return result;
}

const researchWorkerOptions = {
  connection: getRedisConnectionOptions(),
  lockDuration: RESEARCH_LOCK_DURATION_MS,
  stalledInterval: RESEARCH_STALLED_INTERVAL_MS,
  maxStalledCount: RESEARCH_MAX_STALLED_COUNT,
};

export function createResearchWorker() {
  return new Worker<AiAgentJobPayload>(
    QUEUE_NAMES.AI_HIGH,
    processResearchJob,
    {
      ...researchWorkerOptions,
      concurrency: 3,
    },
  );
}

export function createFastResearchWorker() {
  return new Worker<AiAgentJobPayload>(
    QUEUE_NAMES.AI_FAST,
    processResearchJob,
    {
      ...researchWorkerOptions,
      concurrency: 5,
    },
  );
}

export async function completeResearchJobWithFallback(input: {
  agentJobId: string;
  query: string;
  countryCode?: string;
  jurisdiction?: string;
  researchMode?: string;
  toolName?: string;
  matterId?: unknown;
  error?: unknown;
}): Promise<void> {
  const outputMarkdown = buildFallbackResearchMemo({
    query: input.query,
    countryCode: input.countryCode,
    jurisdiction: input.jurisdiction,
    researchMode: input.researchMode,
    reason: input.error instanceof Error ? input.error.message : String(input.error ?? ''),
  });
  const result = {
    toolName: input.toolName,
    phase: 'completed',
    query: input.query,
    outputMarkdown,
    draftMarkdown: outputMarkdown,
    citations: [],
    countryCode: input.countryCode,
    jurisdiction: input.jurisdiction,
    matterId: input.matterId,
    provider: 'fallback',
    modelName: 'fallback',
    researchMode: input.researchMode,
    degraded: true,
    requiresLawyerReview: true,
  };
  await prisma.agentJob.updateMany({
    where: { id: input.agentJobId, NOT: { status: 'COMPLETED' } },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
      error: null,
      result: result as object,
    },
  });
}
