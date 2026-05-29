import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { Queue } from 'bullmq';
import { AICreditLedgerService } from '@/ai-credits/ai-credit-ledger.service';
import { COPILOT_TOOL_TASK_MAP } from '@/ai-credits/task-types';
import { normalizeBillingPlan } from '@/config/billing-plans';
import { CopilotToolName } from '@/ai/copilot.types';
import { AutomationRunPayload } from '@/automations/automation.types';
import { PrismaService } from '@/prisma/prisma.service';
import {
  AI_JOB_TYPES,
  ANONYMIZATION_JOB_TYPES,
  AUTOMATION_JOB_TYPES,
  LEGAL_INGEST_JOB_TYPES,
  NOTIFICATION_JOB_TYPES,
  QUEUE_NAMES,
} from './jobs.constants';
import {
  AiAgentJobPayload,
  AnonymizationJobPayload,
  LegalIngestJobPayload,
  NotificationDispatchPayload,
} from './jobs.types';

export interface OcrJobPayload {
  documentId: string;
  tenantId?: string;
  userId: string;
  fileUrl: string;
  scope: 'TENANT' | 'CONSUMER';
}

export interface EnqueueResult {
  agentJobId: string;
  bullJobId?: string;
  queue: string;
  status: string;
  message?: string;
}

@Injectable()
export class JobsService implements OnModuleDestroy {
  private readonly queues = new Map<string, Queue>();

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly aiCreditLedger: AICreditLedgerService,
  ) {}

  private getRedisConnectionOptions() {
    return {
      url: this.configService.get<string>('REDIS_URL', 'redis://localhost:6379'),
      maxRetriesPerRequest: null,
    };
  }

  private getQueue(name: string): Queue {
    let queue = this.queues.get(name);
    if (!queue) {
      queue = new Queue(name, { connection: this.getRedisConnectionOptions() });
      this.queues.set(name, queue);
    }
    return queue;
  }

  async enqueueOcrJob(payload: OcrJobPayload): Promise<EnqueueResult> {
    return this.enqueueJob({
      queue: QUEUE_NAMES.OCR,
      jobName: 'ocr-extract',
      jobType: 'OCR_EXTRACT',
      userId: payload.userId,
      tenantId: payload.tenantId,
      payload,
    });
  }

  async enqueueCopilotAiJob(input: {
    toolName: CopilotToolName;
    tenantId: string;
    userId: string;
    userRole?: string;
    sessionId?: string;
    params: Record<string, unknown>;
    priority?: 'high' | 'low';
    billingPlan?: string | null;
  }): Promise<EnqueueResult> {
    const taskType = COPILOT_TOOL_TASK_MAP[input.toolName];
    if (taskType) {
      await this.aiCreditLedger.assertSufficientBalance({
        userId: input.userId,
        tenantId: input.tenantId,
        taskType,
      });
    }

    const priority =
      input.priority ??
      resolveLawyerAiQueuePriority({
        toolName: input.toolName,
        billingPlan: input.billingPlan,
      });

    const jobType = mapToolToJobType(input.toolName);
    const queue = priority === 'high' ? QUEUE_NAMES.AI_HIGH : QUEUE_NAMES.AI_LOW;

    const agentJob = await this.prisma.agentJob.create({
      data: {
        queue,
        jobType,
        status: 'QUEUED',
        userId: input.userId,
        tenantId: input.tenantId,
        payload: {
          toolName: input.toolName,
          sessionId: input.sessionId,
          params: input.params,
        } as Prisma.InputJsonValue,
      },
    });

    const aiPayload: AiAgentJobPayload = {
      agentJobId: agentJob.id,
      jobType,
      tenantId: input.tenantId,
      userId: input.userId,
      userRole: input.userRole,
      sessionId: input.sessionId,
      toolName: input.toolName,
      params: input.params,
    };

    return this.enqueueJob({
      queue,
      jobName: input.toolName,
      jobType,
      userId: input.userId,
      tenantId: input.tenantId,
      payload: aiPayload,
      existingAgentJobId: agentJob.id,
    });
  }

  async enqueueNotificationDispatch(
    payload: NotificationDispatchPayload,
  ): Promise<EnqueueResult> {
    return this.enqueueJob({
      queue: QUEUE_NAMES.NOTIFICATIONS,
      jobName: NOTIFICATION_JOB_TYPES.DISPATCH,
      jobType: NOTIFICATION_JOB_TYPES.DISPATCH,
      userId: payload.userId,
      tenantId: payload.tenantId,
      payload,
    });
  }

  async enqueueAutomationRun(payload: AutomationRunPayload): Promise<EnqueueResult> {
    return this.enqueueJob({
      queue: QUEUE_NAMES.AUTOMATIONS,
      jobName: AUTOMATION_JOB_TYPES.EXECUTE,
      jobType: AUTOMATION_JOB_TYPES.EXECUTE,
      userId: String(payload.context.userId ?? payload.tenantId),
      tenantId: payload.tenantId,
      payload,
    });
  }

  async enqueueAnonymizationJob(payload: AnonymizationJobPayload): Promise<EnqueueResult> {
    return this.enqueueJob({
      queue: QUEUE_NAMES.ANONYMIZATION,
      jobName: ANONYMIZATION_JOB_TYPES.PROCESS,
      jobType: ANONYMIZATION_JOB_TYPES.PROCESS,
      userId: 'system',
      payload,
    });
  }

  async enqueueLegalIngestJob(payload: LegalIngestJobPayload): Promise<EnqueueResult> {
    return this.enqueueJob({
      queue: QUEUE_NAMES.LEGAL_INGEST,
      jobName: LEGAL_INGEST_JOB_TYPES.COURTLISTENER_SYNC,
      jobType: LEGAL_INGEST_JOB_TYPES.COURTLISTENER_SYNC,
      userId: 'system',
      payload,
    });
  }

  async enqueueAgentJob(input: {
    agentId: string;
    jobType: string;
    tenantId: string;
    userId: string;
    params: Record<string, unknown>;
    priority?: 'high' | 'low';
    sessionId?: string;
  }): Promise<EnqueueResult> {
    const queue =
      input.priority === 'high' ? QUEUE_NAMES.AI_HIGH : QUEUE_NAMES.AI_LOW;

    const agentJob = await this.prisma.agentJob.create({
      data: {
        queue,
        jobType: input.jobType,
        status: 'QUEUED',
        userId: input.userId,
        tenantId: input.tenantId,
        payload: {
          agentId: input.agentId,
          sessionId: input.sessionId,
          params: input.params,
        } as Prisma.InputJsonValue,
      },
    });

    const aiPayload: AiAgentJobPayload = {
      agentJobId: agentJob.id,
      jobType: input.jobType,
      tenantId: input.tenantId,
      userId: input.userId,
      sessionId: input.sessionId,
      params: input.params,
    };

    return this.enqueueJob({
      queue,
      jobName: input.agentId,
      jobType: input.jobType,
      userId: input.userId,
      tenantId: input.tenantId,
      payload: aiPayload,
      existingAgentJobId: agentJob.id,
    });
  }

  async enqueueDeadlineAgentJob(input: {
    tenantId: string;
    userId: string;
    params: Record<string, unknown>;
  }): Promise<EnqueueResult> {
    const agentJob = await this.prisma.agentJob.create({
      data: {
        queue: QUEUE_NAMES.NOTIFICATIONS,
        jobType: AI_JOB_TYPES.DEADLINE_AGENT,
        status: 'QUEUED',
        userId: input.userId,
        tenantId: input.tenantId,
        payload: input.params as Prisma.InputJsonValue,
      },
    });

    const payload: NotificationDispatchPayload = {
      agentJobId: agentJob.id,
      userId: input.userId,
      tenantId: input.tenantId,
      jobType: AI_JOB_TYPES.DEADLINE_AGENT,
      params: input.params,
    };

    return this.enqueueJob({
      queue: QUEUE_NAMES.NOTIFICATIONS,
      jobName: AI_JOB_TYPES.DEADLINE_AGENT,
      jobType: AI_JOB_TYPES.DEADLINE_AGENT,
      userId: input.userId,
      tenantId: input.tenantId,
      payload,
      existingAgentJobId: agentJob.id,
    });
  }

  async enqueueOutcomeRefresh(input: {
    tenantId: string;
    matterId: string;
    userId: string;
    userRole?: string;
  }): Promise<EnqueueResult> {
    const agentJob = await this.prisma.agentJob.create({
      data: {
        queue: QUEUE_NAMES.AI_LOW,
        jobType: AI_JOB_TYPES.OUTCOME_REFRESH,
        status: 'QUEUED',
        userId: input.userId,
        tenantId: input.tenantId,
        payload: {
          matterId: input.matterId,
          userRole: input.userRole,
        } as Prisma.InputJsonValue,
      },
    });

    const aiPayload: AiAgentJobPayload = {
      agentJobId: agentJob.id,
      jobType: AI_JOB_TYPES.OUTCOME_REFRESH,
      tenantId: input.tenantId,
      userId: input.userId,
      userRole: input.userRole,
      params: { matterId: input.matterId },
    };

    return this.enqueueJob({
      queue: QUEUE_NAMES.AI_LOW,
      jobName: AI_JOB_TYPES.OUTCOME_REFRESH,
      jobType: AI_JOB_TYPES.OUTCOME_REFRESH,
      userId: input.userId,
      tenantId: input.tenantId,
      payload: aiPayload,
      existingAgentJobId: agentJob.id,
    });
  }

  private async enqueueJob(input: {
    queue: string;
    jobName: string;
    jobType: string;
    userId: string;
    tenantId?: string;
    payload: unknown;
    existingAgentJobId?: string;
  }): Promise<EnqueueResult> {
    const agentJob = input.existingAgentJobId
      ? { id: input.existingAgentJobId }
      : await this.prisma.agentJob.create({
          data: {
            queue: input.queue,
            jobType: input.jobType,
            status: 'QUEUED',
            userId: input.userId,
            tenantId: input.tenantId,
            payload: input.payload as Prisma.InputJsonValue,
          },
        });

    try {
      const bullJob = await this.getQueue(input.queue).add(
        input.jobName,
        input.payload,
        {
          removeOnComplete: 100,
          removeOnFail: 50,
          attempts: 3,
        },
      );

      return {
        agentJobId: agentJob.id,
        bullJobId: String(bullJob.id),
        queue: input.queue,
        status: 'QUEUED',
      };
    } catch (error) {
      await this.prisma.agentJob.update({
        where: { id: agentJob.id },
        data: {
          status: 'FAILED',
          error: error instanceof Error ? error.message : 'Queue enqueue failed',
        },
      });

      return {
        agentJobId: agentJob.id,
        queue: input.queue,
        status: 'FAILED',
        message: 'Job recorded but queue is unavailable',
      };
    }
  }

  async onModuleDestroy() {
    await Promise.all([...this.queues.values()].map((queue) => queue.close()));
  }
}

function mapToolToJobType(toolName: CopilotToolName): string {
  switch (toolName) {
    case 'summarize_matter':
      return AI_JOB_TYPES.SUMMARIZE_MATTER;
    case 'legal_research_memo':
      return AI_JOB_TYPES.LEGAL_RESEARCH_MEMO;
    case 'draft_document':
      return AI_JOB_TYPES.DRAFT_DOCUMENT;
    case 'suggest_next_steps':
      return AI_JOB_TYPES.SUGGEST_NEXT_STEPS;
    default:
      return toolName.toUpperCase();
  }
}

export function resolveLawyerAiQueuePriority(input: {
  toolName: CopilotToolName;
  billingPlan?: string | null;
}): 'high' | 'low' {
  if (input.toolName === 'legal_research_memo') {
    return 'high';
  }

  const plan = normalizeBillingPlan(input.billingPlan);
  if (plan === 'ENTERPRISE' || plan === 'PROFESSIONAL') {
    return 'high';
  }

  return 'low';
}
