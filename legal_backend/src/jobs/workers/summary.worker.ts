import { Worker, Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { AI_JOB_TYPES } from '../jobs.constants';
import { REALTIME_EVENTS } from '@/realtime/realtime-events';
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

async function loadMatterContext(tenantId: string, matterId?: string) {
  if (!matterId) {
    return null;
  }

  return prisma.matter.findFirst({
    where: { id: matterId, tenantId },
    include: {
      client: true,
      tasks: { take: 10, orderBy: { createdAt: 'desc' } },
    },
  });
}

async function processSummaryJob(job: Job<AiAgentJobPayload>) {
  const payload = job.data;

  await prisma.agentJob.update({
    where: { id: payload.agentJobId },
    data: { status: 'PROCESSING', attempts: { increment: 1 } },
  });

  const { aiGateway, automationEngine, realtime } = await getWorkerServices();
  realtime.publishToTenant(payload.tenantId, REALTIME_EVENTS.AGENT_JOB_UPDATED, {
    entityId: payload.agentJobId,
    action: 'processing',
    userId: payload.userId,
  });

  const matter = await loadMatterContext(
    payload.tenantId,
    payload.params.matterId as string | undefined,
  );

  let outputMarkdown = '';
  let provider = 'internal';
  let modelName = 'heuristic-fallback-v1';

  if (payload.jobType === AI_JOB_TYPES.DOCUMENT_EXPLAINER) {
    const result = await aiGateway.runDocumentExplain({
      userId: payload.userId,
      tenantId: payload.tenantId,
      matterId: payload.params.matterId as string | undefined,
      documentId: String(payload.params.documentId ?? ''),
      documentText: String(payload.params.documentText ?? ''),
    });
    outputMarkdown = result.outputMarkdown;
    provider = result.provider;
    modelName = result.modelName;
  } else if (payload.jobType === AI_JOB_TYPES.EVIDENCE_GAP) {
    const result = await aiGateway.runEvidenceGapAnalysis({
      userId: payload.userId,
      tenantId: payload.tenantId,
      matterId: payload.params.matterId as string | undefined,
      matterTitle: payload.params.matterTitle as string | undefined,
      factsSummary: String(payload.params.factsSummary ?? ''),
    });
    outputMarkdown = result.outputMarkdown;
    provider = result.provider;
    modelName = result.modelName;
  } else if (payload.jobType === AI_JOB_TYPES.BILLING_RECOVERY) {
    const result = await aiGateway.runBillingRecovery({
      userId: payload.userId,
      tenantId: payload.tenantId,
      matterId: payload.params.matterId as string | undefined,
    });
    outputMarkdown = result.outputMarkdown;
    provider = result.provider;
    modelName = result.modelName;
  } else if (payload.toolName === 'summarize_matter') {
    const summary = await aiGateway.runMatterSummary({
      userId: payload.userId,
      tenantId: payload.tenantId,
      matterId: payload.params.matterId as string | undefined,
      matterTitle: matter?.title,
      matterStatus: matter?.status,
      practiceArea: matter?.practiceArea ?? undefined,
      clientName: matter?.client?.name ?? undefined,
      openTasks: matter?.tasks.map((task) => ({
        title: task.title,
        status: task.status,
      })),
    });
    outputMarkdown = summary.outputMarkdown;
    provider = summary.provider;
    modelName = summary.modelName;
  } else if (payload.jobType === AI_JOB_TYPES.OUTCOME_REFRESH) {
    const { matterOutcome: matterOutcomeService } = await getWorkerServices();
    if (matterOutcomeService && payload.params.matterId) {
      await matterOutcomeService.generate(
        payload.tenantId,
        String(payload.params.matterId),
        payload.userId,
        payload.userRole,
      );
      outputMarkdown = 'Outcome analysis refresh completed.';
      provider = 'matter-outcome';
      modelName = 'outcome-refresh-v1';
    } else {
      outputMarkdown = 'Outcome refresh skipped — matter outcome service unavailable.';
    }
  } else if (payload.toolName === 'draft_document') {
    const draft = await aiGateway.runDocumentDraft({
      userId: payload.userId,
      tenantId: payload.tenantId,
      matterId: payload.params.matterId as string | undefined,
      matterTitle: matter?.title,
      documentType: String(payload.params.documentType ?? 'memo'),
      instructions: String(payload.params.instructions ?? ''),
    });
    outputMarkdown = draft.outputMarkdown;
    provider = draft.provider;
    modelName = draft.modelName;
  } else {
    outputMarkdown = [
      '# Suggested next steps',
      '',
      '1. Review matter timeline and confirm upcoming deadlines.',
      '2. Follow up with client on outstanding document requests.',
      '3. Log time for recent research and drafting work.',
      matter ? `\n_Matter: ${matter.title}_` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }

  const result = {
    toolName: payload.toolName,
    outputMarkdown,
    matterId: payload.params.matterId,
    provider,
    modelName,
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
    const copilotMessage = await prisma.copilotMessage.create({
      data: {
        sessionId: payload.sessionId,
        role: 'assistant',
        content: outputMarkdown,
        citations: [],
      },
    });

    realtime.publishToUser(payload.userId, REALTIME_EVENTS.COPILOT_MESSAGE_CREATED, {
      tenantId: payload.tenantId,
      entityId: copilotMessage.id,
      action: 'created',
      data: { sessionId: payload.sessionId, toolName: payload.toolName },
    });
    realtime.publishToUser(payload.userId, REALTIME_EVENTS.COPILOT_JOB_COMPLETED, {
      tenantId: payload.tenantId,
      entityId: payload.agentJobId,
      action: 'completed',
      data: { sessionId: payload.sessionId, toolName: payload.toolName },
    });
  }

  realtime.publishToTenant(payload.tenantId, REALTIME_EVENTS.AGENT_JOB_UPDATED, {
    entityId: payload.agentJobId,
    action: 'completed',
    userId: payload.userId,
  });
  realtime.publishDashboardRefresh(payload.tenantId, payload.agentJobId);

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

export function createSummaryWorker() {
  return new Worker<AiAgentJobPayload>(
    QUEUE_NAMES.AI_LOW,
    processSummaryJob,
    {
      connection: getRedisConnectionOptions(),
      concurrency: 3,
    },
  );
}
