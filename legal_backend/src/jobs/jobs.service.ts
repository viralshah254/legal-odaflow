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
  MIGRATION_JOB_TYPES,
  NOTIFICATION_JOB_TYPES,
  QUEUE_NAMES,
  SEARCH_INDEX_JOB_TYPES,
} from './jobs.constants';
import { bullmqAttemptsForJobType } from './research-queue.policy';
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
  scope: 'TENANT' | 'CONSUMER' | 'LEAD';
  countryCode?: string;
}

export interface ClioMigrationJobPayload {
  jobId: string;
  tenantId: string;
  fileName: string;
  rowCount: number;
  parsedRowCount: number;
  entityTypes: string[];
  csvContent?: string;
  agentJobId?: string;
}

export interface SearchIndexJobPayload {
  tenantId: string;
  entityType: 'matter' | 'client' | 'document' | 'task';
  entityId: string;
  action: 'upsert' | 'delete';
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

  async enqueueLeadDocumentOcrJob(input: {
    leadDocumentId: string;
    tenantId: string;
    userId: string;
    fileUrl: string;
  }): Promise<EnqueueResult> {
    return this.enqueueOcrJob({
      documentId: input.leadDocumentId,
      tenantId: input.tenantId,
      userId: input.userId,
      fileUrl: input.fileUrl,
      scope: 'LEAD',
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
    const isFastResearch =
      input.toolName === 'legal_research_memo' &&
      (input.params?.researchMode === 'FAST' || input.params?.researchMode === 'GUIDANCE');
    const queue = isFastResearch
      ? QUEUE_NAMES.AI_FAST
      : priority === 'high'
        ? QUEUE_NAMES.AI_HIGH
        : QUEUE_NAMES.AI_LOW;

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
    const jobType = payload.jobType ?? LEGAL_INGEST_JOB_TYPES.COURTLISTENER_SYNC;
    return this.enqueueJob({
      queue: QUEUE_NAMES.LEGAL_INGEST,
      jobName: jobType,
      jobType,
      userId: 'system',
      payload: { ...payload, jobType },
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

  async enqueueLeadDraftGenerate(input: {
    leadId: string;
    tenantId: string;
    userId: string;
    documentType: string;
    planningAnswers?: Record<string, unknown>;
    countryCode?: string;
    jurisdiction?: string;
  }): Promise<EnqueueResult> {
    const agentJob = await this.prisma.agentJob.create({
      data: {
        queue: QUEUE_NAMES.AI_LOW,
        jobType: AI_JOB_TYPES.LEAD_DRAFT_GENERATE,
        status: 'QUEUED',
        userId: input.userId,
        tenantId: input.tenantId,
        payload: {
          leadId: input.leadId,
          documentType: input.documentType,
          planningAnswers: input.planningAnswers,
          countryCode: input.countryCode,
          jurisdiction: input.jurisdiction,
        } as Prisma.InputJsonValue,
      },
    });

    const aiPayload: AiAgentJobPayload = {
      agentJobId: agentJob.id,
      jobType: AI_JOB_TYPES.LEAD_DRAFT_GENERATE,
      tenantId: input.tenantId,
      userId: input.userId,
      params: {
        leadId: input.leadId,
        documentType: input.documentType,
        planningAnswers: input.planningAnswers,
        countryCode: input.countryCode,
        jurisdiction: input.jurisdiction,
      },
    };

    return this.enqueueJob({
      queue: QUEUE_NAMES.AI_LOW,
      jobName: AI_JOB_TYPES.LEAD_DRAFT_GENERATE,
      jobType: AI_JOB_TYPES.LEAD_DRAFT_GENERATE,
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

    const queuePayload =
      typeof input.payload === 'object' && input.payload !== null
        ? { ...input.payload, agentJobId: agentJob.id }
        : { agentJobId: agentJob.id, value: input.payload };

    try {
      const bullJob = await this.getQueue(input.queue).add(
        input.jobName,
        queuePayload,
        {
          removeOnComplete: 100,
          removeOnFail: 50,
          attempts: bullmqAttemptsForJobType(input.jobType),
          ...(input.jobType === NOTIFICATION_JOB_TYPES.DISPATCH &&
            typeof input.payload === 'object' && input.payload !== null && 'notificationId' in input.payload
            ? { jobId: `notification-${(input.payload as { notificationId: string }).notificationId}`, backoff: { type: 'exponential', delay: 5000 } } : {}),
          ...(input.jobType === AI_JOB_TYPES.MEETING_TRANSCRIBE &&
          typeof input.payload === 'object' &&
          input.payload !== null &&
          'meetingId' in input.payload
            ? { jobId: `meeting-transcribe-${(input.payload as { meetingId: string }).meetingId}` }
            : {}),
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

  async enqueueClioMigration(payload: ClioMigrationJobPayload): Promise<EnqueueResult> {
    const agentJob = await this.prisma.agentJob.create({
      data: {
        queue: QUEUE_NAMES.MIGRATION,
        jobType: MIGRATION_JOB_TYPES.CLIO_IMPORT,
        status: 'QUEUED',
        userId: payload.tenantId,
        tenantId: payload.tenantId,
        payload: payload as unknown as Prisma.InputJsonValue,
      },
    });

    const fullPayload: ClioMigrationJobPayload = {
      ...payload,
      agentJobId: agentJob.id,
    };

    try {
      const bullJob = await this.getQueue(QUEUE_NAMES.MIGRATION).add(
        MIGRATION_JOB_TYPES.CLIO_IMPORT,
        fullPayload,
        {
          removeOnComplete: 100,
          removeOnFail: 50,
          attempts: 3,
        },
      );

      await this.prisma.agentJob.update({
        where: { id: agentJob.id },
        data: { payload: fullPayload as unknown as Prisma.InputJsonValue },
      });

      return {
        agentJobId: agentJob.id,
        bullJobId: String(bullJob.id),
        queue: QUEUE_NAMES.MIGRATION,
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
        queue: QUEUE_NAMES.MIGRATION,
        status: 'FAILED',
        message: 'Job recorded but queue is unavailable',
      };
    }
  }

  async enqueueSearchIndex(payload: SearchIndexJobPayload): Promise<void> {
    if (this.configService.get<string>('ENABLE_OPENSEARCH', 'false') !== 'true') {
      return;
    }

    const jobName =
      payload.action === 'delete'
        ? SEARCH_INDEX_JOB_TYPES.DELETE
        : SEARCH_INDEX_JOB_TYPES.UPSERT;

    try {
      await this.getQueue(QUEUE_NAMES.SEARCH_INDEX).add(jobName, payload, {
        removeOnComplete: 200,
        removeOnFail: 50,
        attempts: 3,
      });
    } catch {
      // Search indexing is best-effort; Prisma fallback remains available.
    }
  }

  async enqueueMeetingTranscribeJob(input: {
    meetingId: string;
    tenantId: string;
    userId: string;
    audioStorageKey: string;
    mimeType: string;
    durationMs?: number;
  }): Promise<EnqueueResult> {
    return this.enqueueJob({
      queue: QUEUE_NAMES.AI_LOW,
      jobName: AI_JOB_TYPES.MEETING_TRANSCRIBE,
      jobType: AI_JOB_TYPES.MEETING_TRANSCRIBE,
      userId: input.userId,
      tenantId: input.tenantId,
      payload: input,
    });
  }

  async enqueueMatterAutonomy(input: {
    kind: 'matter_init' | 'matter_refresh';
    matterId: string;
    tenantId: string;
    userId: string;
    trigger?: 'create' | 'document_upload' | 'status_change';
  }): Promise<EnqueueResult> {
    const jobType = input.kind === 'matter_init'
      ? AI_JOB_TYPES.MATTER_INIT
      : AI_JOB_TYPES.MATTER_REFRESH;

    // Build a minimal AiAgentJobPayload-compatible record so the worker can
    // process it with the standard pattern.
    const agentJob = await this.prisma.agentJob.create({
      data: {
        queue: QUEUE_NAMES.AI_LOW,
        jobType,
        status: 'QUEUED',
        userId: input.userId,
        tenantId: input.tenantId,
        payload: {
          matterId: input.matterId,
          trigger: input.trigger ?? 'create',
          kind: input.kind,
        } as Prisma.InputJsonValue,
      },
    });

    const payload: Record<string, unknown> = {
      agentJobId: agentJob.id,
      jobType,
      tenantId: input.tenantId,
      userId: input.userId,
      params: {
        matterId: input.matterId,
        trigger: input.trigger ?? 'create',
        kind: input.kind,
      },
    };

    try {
      const bullJob = await this.getQueue(QUEUE_NAMES.AI_LOW).add(
        jobType,
        payload,
        { removeOnComplete: 100, removeOnFail: 50, attempts: 2 },
      );
      return {
        agentJobId: agentJob.id,
        bullJobId: String(bullJob.id),
        queue: QUEUE_NAMES.AI_LOW,
        status: 'QUEUED',
      };
    } catch (err) {
      await this.prisma.agentJob.update({
        where: { id: agentJob.id },
        data: {
          status: 'FAILED',
          error: err instanceof Error ? err.message : 'Queue enqueue failed',
        },
      });
      return {
        agentJobId: agentJob.id,
        queue: QUEUE_NAMES.AI_LOW,
        status: 'FAILED',
        message: 'Job recorded but queue is unavailable',
      };
    }
  }

  async enqueueAgenticWorkflowRun(input: {
    runId: string;
    workflowId: string;
    tenantId: string;
    triggeredBy: string;
    workflowDsl: Record<string, unknown>;
  }): Promise<void> {
    try {
      await this.getQueue(QUEUE_NAMES.AGENTIC_WORKFLOW).add(
        'run-workflow',
        input,
        { removeOnComplete: 100, removeOnFail: 50, attempts: 2 },
      );
    } catch {
      // Queue unavailable — execution fallback handled by service
    }
  }

  async enqueueLegalCrawl(input: {
    sourceId: string;
    sourceUrl: string;
    jurisdiction: string;
    tenantId?: string;
  }): Promise<void> {
    try {
      await this.getQueue(QUEUE_NAMES.LEGAL_CRAWL).add('crawl', input, {
        removeOnComplete: 200,
        removeOnFail: 100,
        attempts: 3,
        backoff: { type: 'exponential', delay: 60000 },
      });
    } catch {
      // Best-effort
    }
  }

  async enqueueObligationCheck(input: { tenantId: string }): Promise<void> {
    try {
      await this.getQueue(QUEUE_NAMES.OBLIGATION_CHECK).add('check', input, {
        removeOnComplete: 50,
        removeOnFail: 20,
        attempts: 2,
      });
    } catch {
      // Best-effort
    }
  }

  async enqueueGooglePlacesScrape(input: {
    runId: string;
    countryCode: string;
    state: string;
    city: string;
    scrapeMode?: 'full' | 'enrichment';
  }): Promise<void> {
    await this.getQueue(QUEUE_NAMES.GOOGLE_PLACES_SCRAPE).add(
      'scrape',
      { ...input, mode: 'scrape' as const },
      {
        removeOnComplete: 50,
        removeOnFail: 20,
        attempts: 5,
        backoff: { type: 'exponential', delay: 30_000 },
      },
    );
  }

  async enqueueGooglePlacesFinalize(input: {
    runId: string;
    countryCode: string;
    state: string;
    city: string;
  }): Promise<void> {
    await this.getQueue(QUEUE_NAMES.GOOGLE_PLACES_SCRAPE).add(
      'finalize-collected',
      { ...input, mode: 'finalize-collected' as const },
      {
        removeOnComplete: 50,
        removeOnFail: 20,
        attempts: 3,
        backoff: { type: 'exponential', delay: 10_000 },
      },
    );
  }

  async cancelGooglePlacesScrapeJobs(runId: string): Promise<void> {
    const queue = this.getQueue(QUEUE_NAMES.GOOGLE_PLACES_SCRAPE);
    for (const state of ['active', 'waiting', 'delayed'] as const) {
      const jobs = await queue.getJobs([state]);
      for (const job of jobs) {
        if (job.data.runId !== runId || job.data.mode === 'finalize-collected') {
          continue;
        }
        try {
          if (state === 'active') {
            await job.moveToFailed(new Error('Cancelled by admin'), job.token ?? '', true);
          } else {
            await job.remove();
          }
        } catch {
          // Best-effort — finalize job will import collected data regardless.
        }
      }
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
