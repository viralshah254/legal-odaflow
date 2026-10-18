import { Injectable, Logger, NotFoundException, BadRequestException, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'crypto';
import { ArtifactAccessResolver } from '@/access/artifact-access.resolver';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { QUEUE_NAMES } from '@/jobs/jobs.constants';
import type { DraftJobStatus, DraftProfile } from './contracts/draft-execution-plan';
import type { QualityTier } from './contracts/model-aliases';
import type { DraftProgressEvent } from './contracts/draft-progress-event';
import { STAGE_PERCENT, STAGE_LABEL } from './contracts/draft-progress-event';

export interface CreateDraftJobDto {
  tenantId: string;
  userId: string;
  matterId?: string;
  profile: DraftProfile;
  documentKind: string;
  qualityTier: QualityTier;
  facts: string;
  jurisdiction?: string;
  courtName?: string;
  clientName?: string;
  opposingParty?: string;
  parties?: {
    plaintiffs: Array<{ name: string; role: string }>;
    defendants: Array<{ name: string; role: string }>;
  };
  attachmentContext?: string;
  formNumber?: string;
  language?: string;
  pinnedSections?: import('@/ai/drafting/draft-pinned-authorities').PinnedSection[];
  pinnedCaseLaws?: import('@/ai/drafting/draft-pinned-authorities').PinnedCaseLaw[];
  /** Client-generated key to prevent duplicate jobs. */
  idempotencyKey?: string;
  /** Link to an existing legacy CourtDraftRecord (migration). */
  courtDraftRecordId?: string;
  /** Link to an existing v3 workspace (migration). */
  workspaceV3Id?: string;
  /** User-confirmed CaseRecord from India drafting confirm UX. */
  confirmedCaseRecord?: Record<string, unknown>;
  accuracyMode?: 'fast' | 'balanced' | 'strict';
  bundleMode?: boolean;
  bundleIndex?: number;
  /** Restrict retrieval tiers (statutes, case_law, etc.). */
  knowledgeSources?: string[];
}

export interface DraftJobSummary {
  jobId: string;
  status: DraftJobStatus;
  stage: string;
  currentStage: string;
  percent: number;
  message: string;
  estimatedCredits: number;
  completedAt?: string;
  blockedReason?: string;
  failureReason?: string;
}

@Injectable()
export class DraftJobService implements OnModuleDestroy {
  private readonly logger = new Logger(DraftJobService.name);
  private readonly draftQueue: Queue;
  private readonly stageSequence = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly access: ArtifactAccessResolver,
  ) {
    this.draftQueue = new Queue(QUEUE_NAMES.DRAFT_GENERATE, {
      connection: {
        url: this.configService.get<string>('REDIS_URL', 'redis://localhost:6379'),
        maxRetriesPerRequest: null,
      },
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.draftQueue.close();
  }

  static computeRequestFingerprint(dto: CreateDraftJobDto): string {
    const payload = JSON.stringify({
      facts: dto.facts,
      documentKind: dto.documentKind,
      profile: dto.profile,
      qualityTier: dto.qualityTier,
      matterId: dto.matterId ?? null,
      jurisdiction: dto.jurisdiction ?? null,
      courtName: dto.courtName ?? null,
      confirmedCaseRecord: dto.confirmedCaseRecord ?? null,
      accuracyMode: dto.accuracyMode ?? null,
      pinnedSections: dto.pinnedSections ?? null,
      pinnedCaseLaws: dto.pinnedCaseLaws ?? null,
      knowledgeSources: dto.knowledgeSources ?? null,
    });
    return createHash('sha256').update(payload).digest('hex').slice(0, 32);
  }

  async create(dto: CreateDraftJobDto): Promise<DraftJobSummary> {
    const idempotencyKey = dto.idempotencyKey ?? randomUUID();
    const operation = 'draft_generate';
    const requestFingerprint = DraftJobService.computeRequestFingerprint(dto);

    if (dto.matterId) {
      await this.access.assertMatterReadable(
        { tenantId: dto.tenantId, userId: dto.userId },
        dto.matterId,
      );
    }

    const existing = await this.prisma.draftJob.findFirst({
      where: {
        tenantId: dto.tenantId,
        userId: dto.userId,
        operation,
        idempotencyKey,
      },
    });
    if (existing) {
      if (existing.requestFingerprint && existing.requestFingerprint !== requestFingerprint) {
        throw new BadRequestException('Idempotency key reused with different request payload');
      }
      this.logger.log(`Returning existing job for idempotency key ${idempotencyKey}`);
      return this.toSummary(existing);
    }

    const estimatedCredits = this.estimateCredits(dto.qualityTier, dto.documentKind);

    let job;
    try {
      job = await this.prisma.draftJob.create({
      data: {
        tenantId: dto.tenantId,
        userId: dto.userId,
        matterId: dto.matterId,
        profile: dto.profile,
        documentKind: dto.documentKind,
        qualityTier: dto.qualityTier,
        status: 'queued',
        currentStage: 'queued',
        idempotencyKey,
        operation,
        requestFingerprint,
        dispatchStatus: 'pending_dispatch',
        estimatedCostUsd: estimatedCredits * 0.01,
        courtDraftRecordId: dto.courtDraftRecordId,
        workspaceV3Id: dto.workspaceV3Id,
        // Persist confirmed CaseRecord + accuracy mode for worker resume
        executionPlanJson: {
          confirmedCaseRecord: dto.confirmedCaseRecord ?? null,
          accuracyMode: dto.accuracyMode ?? null,
          bundleMode: dto.bundleMode ?? null,
          bundleIndex: dto.bundleIndex ?? null,
        } as any,
      },
    });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const raced = await this.prisma.draftJob.findFirst({
          where: { tenantId: dto.tenantId, userId: dto.userId, operation, idempotencyKey },
        });
        if (raced) {
          if (raced.requestFingerprint && raced.requestFingerprint !== requestFingerprint) {
            throw new BadRequestException('Idempotency key reused with different request payload');
          }
          return this.toSummary(raced);
        }
      }
      throw err;
    }

    // Enqueue the BullMQ job with the full DTO as payload
    try {
    await this.draftQueue.add(
      'DRAFT_GENERATE',
      {
        jobId: job.id,
        ...dto,
        idempotencyKey,
      },
      {
        jobId: job.id,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: false,
        removeOnFail: false,
      },
    );
    await this.prisma.draftJob.update({
      where: { id: job.id },
      data: { dispatchStatus: 'dispatched' },
    });
    } catch (queueErr) {
      this.logger.warn(`Queue dispatch failed for job ${job.id}: ${String(queueErr)}`);
      await this.prisma.draftJob.update({
        where: { id: job.id },
        data: { dispatchStatus: 'pending_dispatch', failureReason: 'queue_dispatch_failed' },
      });
    }

    await this.audit(job.id, 'status_change', { status: 'queued' });

    this.logger.log(`Draft job ${job.id} created for kind=${dto.documentKind} tier=${dto.qualityTier}`);
    return this.toSummary(job);
  }

  async getStatus(jobId: string, tenantId: string): Promise<DraftJobSummary> {
    const job = await this.prisma.draftJob.findFirst({
      where: { id: jobId, tenantId },
    });
    if (!job) throw new NotFoundException(`Draft job ${jobId} not found`);
    return this.toSummary(job);
  }

  async getResult(jobId: string, tenantId: string) {
    const job = await this.prisma.draftJob.findFirst({
      where: { id: jobId, tenantId },
      include: { sections: true, issues: true },
    });
    if (!job) throw new NotFoundException(`Draft job ${jobId} not found`);
    if (job.status !== 'ready') {
      throw new BadRequestException(`Job ${jobId} is not ready yet — current status: ${job.status}`);
    }
    if (!job.courtDraftRecordId) {
      throw new BadRequestException(`Job ${jobId} is ready but its saved draft is unavailable`);
    }
    return {
      jobId: job.id,
      draftId: job.courtDraftRecordId,
      courtDraftRecordId: job.courtDraftRecordId,
      status: job.status,
      assembledDraft: job.assembledDraftJson,
      verificationReport: job.verificationReportJson,
      sections: job.sections,
      issues: job.issues,
      totalCostUsd: job.actualCostUsd,
      completedAt: job.completedAt,
    };
  }

  async cancel(jobId: string, tenantId: string): Promise<void> {
    const job = await this.prisma.draftJob.findFirst({
      where: { id: jobId, tenantId },
    });
    if (!job) throw new NotFoundException(`Draft job ${jobId} not found`);
    if (['ready', 'failed', 'cancelled'].includes(job.status)) {
      throw new BadRequestException(`Job ${jobId} is already in terminal state: ${job.status}`);
    }

    const bullJob = await this.draftQueue.getJob(jobId);
    if (bullJob) {
      await bullJob.remove();
    }

    await this.updateStatus(jobId, 'cancelled', 'cancelled');
    await this.audit(jobId, 'status_change', { status: 'cancelled', reason: 'user_request' });
  }

  /** Advance job stage and emit progress. Used by the worker. */
  async advanceStage(
    jobId: string,
    stage: DraftJobStatus,
    extra?: Record<string, unknown>,
  ): Promise<DraftProgressEvent> {
    await this.prisma.draftJob.update({
      where: { id: jobId },
      data: { status: stage, currentStage: stage, updatedAt: new Date() },
    });
    await this.audit(jobId, 'stage_started', { stage, ...extra });

    const sequence = (this.stageSequence.get(jobId) ?? 0) + 1;
    this.stageSequence.set(jobId, sequence);
    return {
      jobId,
      eventId: randomUUID(),
      sequence,
      status: stage,
      stage,
      percent: STAGE_PERCENT[stage] ?? 0,
      message: STAGE_LABEL[stage] ?? stage,
      timestamp: new Date().toISOString(),
      ...extra,
    } as DraftProgressEvent;
  }

  async markReady(jobId: string, costUsd: number, consumedCredits: number): Promise<void> {
    await this.prisma.draftJob.update({
      where: { id: jobId },
      data: {
        status: 'ready',
        currentStage: 'ready',
        actualCostUsd: costUsd,
        consumedCredits,
        completedAt: new Date(),
      },
    });
    await this.audit(jobId, 'status_change', { status: 'ready', costUsd, consumedCredits });
  }

  async markFailed(jobId: string, reason: string): Promise<void> {
    await this.prisma.draftJob.update({
      where: { id: jobId },
      data: { status: 'failed', currentStage: 'failed', failureReason: reason },
    });
    await this.audit(jobId, 'status_change', { status: 'failed', reason });
  }

  async markBlocked(jobId: string, reason: string): Promise<void> {
    await this.prisma.draftJob.update({
      where: { id: jobId },
      data: { status: 'blocked', currentStage: 'blocked', blockedReason: reason },
    });
    await this.audit(jobId, 'status_change', { status: 'blocked', reason });
  }

  async persistStageOutput(
    jobId: string,
    stage: string,
    outputJson: Record<string, unknown>,
    durationMs: number,
    costUsd = 0,
  ): Promise<void> {
    await this.prisma.draftJobStageResult.create({
      data: { jobId, stage, outputJson: outputJson as Prisma.InputJsonValue, durationMs, costUsd },
    });
  }

  async recordModelUsage(
    jobId: string,
    stage: string,
    model: string,
    inputTokens: number,
    outputTokens: number,
    costUsd: number,
    sectionId?: string,
    durationMs?: number,
  ): Promise<void> {
    await this.prisma.draftJobModelUsage.create({
      data: { jobId, stage, sectionId, model, inputTokens, outputTokens, costUsd, durationMs },
    });
  }

  private async updateStatus(jobId: string, status: string, currentStage: string): Promise<void> {
    await this.prisma.draftJob.update({
      where: { id: jobId },
      data: { status, currentStage },
    });
  }

  private async audit(jobId: string, event: string, metadata?: Record<string, unknown>): Promise<void> {
    await this.prisma.draftJobAuditEvent.create({
      data: { jobId, event, metadata: metadata as Prisma.InputJsonValue | undefined },
    }).catch((err: unknown) => this.logger.warn(`Audit write failed: ${String(err)}`));
  }

  private toSummary(job: {
    id: string;
    status: string;
    currentStage: string;
    estimatedCostUsd: number;
    completedAt?: Date | null;
    blockedReason?: string | null;
    failureReason?: string | null;
  }): DraftJobSummary {
    const stage = job.status as DraftJobStatus;
    return {
      jobId: job.id,
      status: stage,
      stage: stage,
      currentStage: job.currentStage,
      percent: STAGE_PERCENT[stage] ?? 0,
      message: STAGE_LABEL[stage] ?? stage,
      estimatedCredits: Math.round(job.estimatedCostUsd * 100),
      completedAt: job.completedAt?.toISOString(),
      blockedReason: job.blockedReason ?? undefined,
      failureReason: job.failureReason ?? undefined,
    };
  }

  private estimateCredits(qualityTier: QualityTier, documentKind: string): number {
    const baseByTier: Record<QualityTier, number> = {
      express: 15,
      standard: 35,
      premium: 75,
    };
    const base = baseByTier[qualityTier] ?? 35;
    const complexMultiplier = /writ|petition|plaint|revision|appeal/i.test(documentKind) ? 1.5 : 1;
    return Math.round(base * complexMultiplier);
  }
}
