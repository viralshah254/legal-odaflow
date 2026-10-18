import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import type { WorkflowRun, WorkflowStageRun } from '@prisma/client';

@Injectable()
export class WorkflowPersistenceService {
  private readonly logger = new Logger(WorkflowPersistenceService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a WorkflowRun record and returns its ID.
   */
  async startRun(input: {
    tenantId: string;
    userId: string;
    feature: string;
    objective?: string;
    matterId?: string;
    jurisdictionCode?: string;
    riskLevel?: string;
  }): Promise<string> {
    const run = await this.prisma.workflowRun.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId,
        feature: input.feature,
        objective: input.objective,
        matterId: input.matterId,
        jurisdictionCode: input.jurisdictionCode,
        riskLevel: input.riskLevel ?? 'medium',
        status: 'RUNNING',
        progress: 0,
      },
    });
    return run.id;
  }

  /**
   * Starts a stage within a WorkflowRun.
   */
  async startStage(
    runId: string,
    stage: string,
    metadata?: Record<string, unknown>,
  ): Promise<string> {
    const stageRun = await this.prisma.workflowStageRun.create({
      data: {
        workflowId: runId,
        stage,
        status: 'RUNNING',
        startedAt: new Date(),
        metadata: metadata as any,
      },
    });
    await this.prisma.workflowRun.update({
      where: { id: runId },
      data: { currentStage: stage },
    });
    return stageRun.id;
  }

  /**
   * Completes a stage and updates its cost.
   */
  async completeStage(
    stageId: string,
    runId: string,
    options?: {
      costUsd?: number;
      outputRef?: string;
      progress?: number;
    },
  ): Promise<void> {
    await this.prisma.workflowStageRun.update({
      where: { id: stageId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        costUsd: options?.costUsd ?? 0,
        outputRef: options?.outputRef,
      },
    });

    if (options?.progress !== undefined || options?.costUsd !== undefined) {
      await this.prisma.workflowRun.update({
        where: { id: runId },
        data: {
          ...(options?.progress !== undefined ? { progress: options.progress } : {}),
          ...(options?.costUsd !== undefined ? { costUsd: { increment: options.costUsd } } : {}),
        },
      });
    }
  }

  /**
   * Marks a stage as failed.
   */
  async failStage(stageId: string, error: string): Promise<void> {
    await this.prisma.workflowStageRun.update({
      where: { id: stageId },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        errorMessage: error.slice(0, 500),
      },
    });
  }

  /**
   * Marks the entire run as completed.
   */
  async completeRun(
    runId: string,
    options?: { costUsd?: number; resultRef?: string },
  ): Promise<void> {
    await this.prisma.workflowRun.update({
      where: { id: runId },
      data: {
        status: 'COMPLETED',
        progress: 100,
        completedAt: new Date(),
        currentStage: null,
        ...(options?.costUsd !== undefined ? { costUsd: { increment: options.costUsd } } : {}),
        ...(options?.resultRef ? { resultRef: options.resultRef } : {}),
      },
    });
  }

  /**
   * Marks the entire run as failed.
   */
  async failRun(runId: string, errorMessage: string, errorCode?: string): Promise<void> {
    await this.prisma.workflowRun.update({
      where: { id: runId },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        errorMessage: errorMessage.slice(0, 500),
        errorCode: errorCode ?? 'UNKNOWN',
      },
    });
  }

  /**
   * Updates run progress (0-100).
   */
  async updateProgress(runId: string, progress: number): Promise<void> {
    await this.prisma.workflowRun.update({
      where: { id: runId },
      data: { progress: Math.min(100, Math.max(0, Math.round(progress))) },
    });
  }

  /**
   * Gets the current status of a run including its stages.
   */
  async getRunWithStages(runId: string): Promise<WorkflowRun & { stages: WorkflowStageRun[] }> {
    return this.prisma.workflowRun.findUniqueOrThrow({
      where: { id: runId },
      include: { stages: { orderBy: { createdAt: 'asc' } } },
    }) as Promise<WorkflowRun & { stages: WorkflowStageRun[] }>;
  }
}
