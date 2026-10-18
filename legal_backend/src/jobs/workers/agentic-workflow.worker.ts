import { Worker, Job } from 'bullmq';
import { Prisma, PrismaClient } from '@prisma/client';
import { QUEUE_NAMES } from '../jobs.constants';
import { getWorkerServices } from './worker-context';
import { routeIntent } from '@/ai/intent-router';

const prisma = new PrismaClient();

function getRedisConnectionOptions() {
  return {
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
    maxRetriesPerRequest: null,
  };
}

export interface AgenticWorkflowRunPayload {
  runId: string;
  workflowId: string;
  tenantId: string;
  triggeredBy: string;
  workflowDsl: Record<string, unknown>;
}

type StepAction = 'research' | 'draft' | 'notify' | 'review' | 'verify' | 'wait';

interface WorkflowStep {
  id: string;
  action: StepAction;
  params?: Record<string, unknown>;
  dependsOn?: string[];
}

async function updateRunStatus(
  runId: string,
  workflowId: string,
  status: string,
  stepResults?: Record<string, unknown>,
  error?: string,
) {
  await prisma.agentWorkflowRun.update({
    where: { id: runId },
    data: {
      status,
      completedAt: status === 'completed' || status === 'failed' ? new Date() : undefined,
      ...(error ? { errorMessage: error } : {}),
      ...(stepResults ? { stepResults: stepResults as Prisma.InputJsonValue } : {}),
    },
  });

  await prisma.agentWorkflow.update({
    where: { id: workflowId },
    data: { lastRunStatus: status },
  });
}

async function executeStep(
  step: WorkflowStep,
  context: {
    tenantId: string;
    triggeredBy: string;
    matterId?: string;
    stepResults: Record<string, unknown>;
  },
): Promise<{ success: boolean; output: unknown; error?: string }> {
  const { llmCompletion } = await getWorkerServices();

  switch (step.action) {
    case 'research': {
      const objective = (step.params?.['objective'] as string) ?? 'General legal research';
      const jurisdiction = (step.params?.['jurisdiction'] as string) ?? 'IN';

      // Use LLM for research synthesis
      try {
        const result = await llmCompletion.complete({
          modelName: 'gpt-5.4-mini',
          messages: [
            {
              role: 'system',
              content: 'You are a legal research assistant. Provide a concise research memo.',
            },
            {
              role: 'user',
              content: `Research objective: ${objective}\nJurisdiction: ${jurisdiction}`,
            },
          ],
          maxTokens: 1500,
        });
        return { success: true, output: { summary: result.content } };
      } catch (err) {
        return { success: false, output: null, error: String(err) };
      }
    }

    case 'draft': {
      const documentType = (step.params?.['documentType'] as string) ?? 'legal_document';
      const objective = (step.params?.['objective'] as string) ?? 'Draft legal document';

      try {
        const result = await llmCompletion.complete({
          modelName: 'gpt-5.4-mini',
          messages: [
            { role: 'system', content: 'You are a legal drafter. Draft the requested document section.' },
            { role: 'user', content: `Document type: ${documentType}\nObjective: ${objective}` },
          ],
          maxTokens: 2000,
        });
        return { success: true, output: { draft: result.content } };
      } catch (err) {
        return { success: false, output: null, error: String(err) };
      }
    }

    case 'notify': {
      const message = (step.params?.['message'] as string) ?? 'Workflow step completed';
      const userId = context.triggeredBy;

      try {
        // Create notification record
        const notification = await prisma.notification.create({
          data: {
            userId,
            tenantId: context.tenantId,
            type: 'AGENTIC_WORKFLOW',
            title: 'Workflow update',
            body: message,
            isRead: false,
          },
        });
        return { success: true, output: { notificationId: notification.id } };
      } catch (err) {
        return { success: false, output: null, error: String(err) };
      }
    }

    case 'verify': {
      // Placeholder for verification step — signals that content needs verification
      return {
        success: true,
        output: {
          message: 'Verification queued',
          priorResults: context.stepResults,
        },
      };
    }

    case 'wait': {
      const delayMs = (step.params?.['delayMs'] as number) ?? 1000;
      await new Promise((resolve) => setTimeout(resolve, Math.min(delayMs, 5000)));
      return { success: true, output: { waited: delayMs } };
    }

    default:
      return { success: false, output: null, error: `Unknown action: ${step.action}` };
  }
}

async function processAgenticWorkflowJob(job: Job<AgenticWorkflowRunPayload>) {
  const { runId, workflowId, tenantId, triggeredBy, workflowDsl } = job.data;

  // --- Durability: restore partial state from prior attempt ---
  let stepResults: Record<string, unknown> = {};
  let hasError = false;

  try {
    const existingRun = await prisma.agentWorkflowRun.findUnique({
      where: { id: runId },
      select: { stepResults: true, status: true },
    });

    // Resume from partial results if this is a retry
    if (existingRun?.stepResults && typeof existingRun.stepResults === 'object') {
      stepResults = existingRun.stepResults as Record<string, unknown>;
    }

    // Don't re-run an already completed run
    if (existingRun?.status === 'completed') {
      return { runId, status: 'completed', stepResults };
    }

    await updateRunStatus(runId, workflowId, 'running', stepResults);

    // Parse steps from DSL
    const rawSteps = (workflowDsl['steps'] ?? workflowDsl['actions'] ?? []) as Array<Record<string, unknown>>;
    const steps: WorkflowStep[] = rawSteps.map((s, i) => ({
      id: (s['id'] as string) ?? `step_${i}`,
      action: ((s['action'] ?? s['type']) as StepAction) ?? 'wait',
      params: (s['params'] as Record<string, unknown>) ?? {},
      dependsOn: (s['dependsOn'] as string[]) ?? [],
    }));

    const matterId = workflowDsl['matterId'] as string | undefined;

    // Execute steps sequentially — skip already-completed steps (durability checkpoint)
    for (const step of steps) {
      if (stepResults[step.id] !== undefined) {
        // Step already completed in a previous attempt — skip
        continue;
      }

      const result = await executeStep(step, { tenantId, triggeredBy, matterId, stepResults });
      stepResults[step.id] = result.output;

      // Checkpoint after every step so partial results survive a crash
      await updateRunStatus(runId, workflowId, 'running', stepResults);
      // Report BullMQ progress for UI polling
      await job.updateProgress(Math.round((Object.keys(stepResults).length / steps.length) * 100));

      if (!result.success && step.params?.['required'] !== false) {
        hasError = true;
        await updateRunStatus(runId, workflowId, 'failed', stepResults, result.error);
        break;
      }
    }

    if (!hasError) {
      await updateRunStatus(runId, workflowId, 'completed', stepResults);
    }
  } catch (err) {
    await updateRunStatus(runId, workflowId, 'failed', stepResults, String(err));
  }

  return { runId, status: hasError ? 'failed' : 'completed', stepResults };
}

export function createAgenticWorkflowWorker() {
  return new Worker<AgenticWorkflowRunPayload>(
    QUEUE_NAMES.AGENTIC_WORKFLOW,
    processAgenticWorkflowJob,
    {
      connection: getRedisConnectionOptions(),
      concurrency: 5,
      // Durability: automatic retry with exponential back-off; max 3 attempts.
      // BullMQ persists job state in Redis so runs survive worker restarts.
      settings: {
        backoffStrategy: (attemptsMade: number) => Math.min(1000 * 2 ** attemptsMade, 30000),
      },
    },
  );
}

/**
 * Intent router that maps a free-text user message to one or more AI pattern IDs.
 * Shared by copilot chat and the upload → workflow suggestion flow.
 *
 * Returns a ranked list of pattern IDs (from AI-PATTERNS.md) so callers can
 * dispatch to the appropriate agents without hard-coding branching logic.
 */
// routeIntent is now shared from @/ai/intent-router — re-export for any callers
// that previously imported it directly from this worker file.
export { routeIntent };
