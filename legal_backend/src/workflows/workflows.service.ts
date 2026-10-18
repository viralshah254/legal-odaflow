import { Injectable } from '@nestjs/common';
import { Prisma, WorkflowCostLedger, WorkflowRun, WorkflowStageRun } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { DomainError, DomainErrorCode } from '@/common/errors/domain-errors';

export type WorkflowStatus =
  | 'QUEUED'
  | 'RUNNING'
  | 'WAITING_FOR_INPUT'
  | 'VERIFYING'
  | 'REPAIRING'
  | 'COMPLETED'
  | 'PARTIAL'
  | 'FAILED'
  | 'CANCELLED';

const CANCELLABLE_STATUSES: WorkflowStatus[] = ['QUEUED', 'RUNNING', 'WAITING_FOR_INPUT'];
const RETRYABLE_STATUSES: WorkflowStatus[] = ['FAILED', 'PARTIAL'];

export interface ListWorkflowsOptions {
  tenantId: string;
  feature?: string;
  status?: WorkflowStatus;
  matterId?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class WorkflowsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    tenantId: string,
    userId: string,
    feature: string,
    input: Partial<WorkflowRun> = {},
  ): Promise<WorkflowRun> {
    return this.prisma.workflowRun.create({
      data: {
        tenantId,
        userId,
        feature,
        status: 'QUEUED',
        progress: 0,
        objective: input.objective ?? null,
        matterId: input.matterId ?? null,
        inputRef: input.inputRef ?? null,
        riskLevel: input.riskLevel ?? 'medium',
        jurisdictionCode: input.jurisdictionCode ?? null,
        metadata: (input.metadata as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        maxRetries: input.maxRetries ?? 3,
        expiresAt: input.expiresAt ?? null,
      },
    });
  }

  async findOne(id: string, tenantId: string): Promise<WorkflowRun> {
    const workflow = await this.prisma.workflowRun.findFirst({
      where: { id, tenantId },
      include: { stages: { orderBy: { createdAt: 'asc' } } },
    });

    if (!workflow) {
      throw new DomainError(
        DomainErrorCode.WORKFLOW_NOT_FOUND,
        `Workflow ${id} not found`,
        404,
        { workflowId: id },
      );
    }

    return workflow;
  }

  async list(options: ListWorkflowsOptions): Promise<{ data: WorkflowRun[]; total: number }> {
    const { tenantId, feature, status, matterId, page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    const where: Prisma.WorkflowRunWhereInput = {
      tenantId,
      ...(feature ? { feature } : {}),
      ...(status ? { status } : {}),
      ...(matterId ? { matterId } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.workflowRun.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { stages: { orderBy: { createdAt: 'asc' } } },
      }),
      this.prisma.workflowRun.count({ where }),
    ]);

    return { data, total };
  }

  async updateStatus(
    id: string,
    tenantId: string,
    status: WorkflowStatus,
    updates: Partial<Pick<WorkflowRun, 'progress' | 'currentStage' | 'resultRef' | 'errorCode' | 'errorMessage' | 'completedAt' | 'costUsd'>> = {},
  ): Promise<WorkflowRun> {
    await this.findOne(id, tenantId);

    return this.prisma.workflowRun.update({
      where: { id },
      data: {
        status,
        ...(updates.progress !== undefined ? { progress: updates.progress } : {}),
        ...(updates.currentStage !== undefined ? { currentStage: updates.currentStage } : {}),
        ...(updates.resultRef !== undefined ? { resultRef: updates.resultRef } : {}),
        ...(updates.errorCode !== undefined ? { errorCode: updates.errorCode } : {}),
        ...(updates.errorMessage !== undefined ? { errorMessage: updates.errorMessage } : {}),
        ...(updates.costUsd !== undefined ? { costUsd: updates.costUsd } : {}),
        ...(status === 'COMPLETED' || status === 'PARTIAL' || status === 'FAILED' || status === 'CANCELLED'
          ? { completedAt: updates.completedAt ?? new Date() }
          : {}),
      },
    });
  }

  async addStage(
    workflowId: string,
    stage: string,
    metadata?: Record<string, unknown>,
  ): Promise<WorkflowStageRun> {
    return this.prisma.workflowStageRun.create({
      data: {
        workflowId,
        stage,
        status: 'PENDING',
        metadata: (metadata as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      },
    });
  }

  async completeStage(
    stageId: string,
    result: { outputRef?: string; metadata?: Record<string, unknown> },
    costUsd: number,
  ): Promise<WorkflowStageRun> {
    return this.prisma.workflowStageRun.update({
      where: { id: stageId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        costUsd,
        ...(result.outputRef ? { outputRef: result.outputRef } : {}),
        ...(result.metadata
          ? { metadata: result.metadata as Prisma.InputJsonValue }
          : {}),
      },
    });
  }

  async failStage(
    stageId: string,
    errorCode: string,
    errorMessage: string,
  ): Promise<WorkflowStageRun> {
    return this.prisma.workflowStageRun.update({
      where: { id: stageId },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        errorCode,
        errorMessage,
      },
    });
  }

  async cancel(id: string, tenantId: string, userId: string): Promise<WorkflowRun> {
    const workflow = await this.findOne(id, tenantId);

    if (workflow.status === 'CANCELLED') {
      throw new DomainError(
        DomainErrorCode.WORKFLOW_ALREADY_CANCELLED,
        `Workflow ${id} is already cancelled`,
        422,
        { workflowId: id, status: workflow.status },
      );
    }

    if (!CANCELLABLE_STATUSES.includes(workflow.status as WorkflowStatus)) {
      throw new DomainError(
        DomainErrorCode.WORKFLOW_NOT_CANCELLABLE,
        `Workflow ${id} cannot be cancelled in status "${workflow.status}"`,
        422,
        { workflowId: id, status: workflow.status, cancellableStatuses: CANCELLABLE_STATUSES },
      );
    }

    return this.prisma.workflowRun.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        completedAt: new Date(),
        metadata: {
          ...(typeof workflow.metadata === 'object' && workflow.metadata !== null
            ? (workflow.metadata as Record<string, unknown>)
            : {}),
          cancelledByUserId: userId,
          cancelledAt: new Date().toISOString(),
        },
      },
    });
  }

  async retry(id: string, tenantId: string): Promise<WorkflowRun> {
    const workflow = await this.findOne(id, tenantId);

    if (!RETRYABLE_STATUSES.includes(workflow.status as WorkflowStatus)) {
      throw new DomainError(
        DomainErrorCode.WORKFLOW_NOT_CANCELLABLE,
        `Workflow ${id} cannot be retried in status "${workflow.status}". Must be FAILED or PARTIAL.`,
        422,
        { workflowId: id, status: workflow.status, retryableStatuses: RETRYABLE_STATUSES },
      );
    }

    if (workflow.retryCount >= workflow.maxRetries) {
      throw new DomainError(
        DomainErrorCode.WORKFLOW_NOT_CANCELLABLE,
        `Workflow ${id} has exhausted max retries (${workflow.maxRetries})`,
        422,
        { workflowId: id, retryCount: workflow.retryCount, maxRetries: workflow.maxRetries },
      );
    }

    return this.prisma.workflowRun.update({
      where: { id },
      data: {
        status: 'QUEUED',
        retryCount: { increment: 1 },
        errorCode: null,
        errorMessage: null,
        completedAt: null,
      },
    });
  }

  async trackCost(
    workflowId: string,
    tenantId: string,
    costs: Partial<Omit<WorkflowCostLedger, 'id' | 'workflowId' | 'tenantId' | 'userId' | 'feature' | 'createdAt' | 'updatedAt' | 'totalCostUsd'>>,
  ): Promise<WorkflowCostLedger> {
    const workflow = await this.findOne(workflowId, tenantId);

    const totalCostUsd =
      (costs.retrievalCostUsd ?? 0) +
      (costs.modelCostUsd ?? 0) +
      (costs.storageCostUsd ?? 0) +
      (costs.ocrCostUsd ?? 0) +
      (costs.exportCostUsd ?? 0) +
      (costs.repairCostUsd ?? 0) -
      (costs.cacheSavingsUsd ?? 0);

    return this.prisma.workflowCostLedger.upsert({
      where: { workflowId },
      create: {
        workflowId,
        tenantId,
        userId: workflow.userId,
        feature: workflow.feature,
        retrievalCostUsd: costs.retrievalCostUsd ?? 0,
        modelCostUsd: costs.modelCostUsd ?? 0,
        storageCostUsd: costs.storageCostUsd ?? 0,
        ocrCostUsd: costs.ocrCostUsd ?? 0,
        exportCostUsd: costs.exportCostUsd ?? 0,
        repairCostUsd: costs.repairCostUsd ?? 0,
        cacheSavingsUsd: costs.cacheSavingsUsd ?? 0,
        totalCostUsd,
      },
      update: {
        retrievalCostUsd: { increment: costs.retrievalCostUsd ?? 0 },
        modelCostUsd: { increment: costs.modelCostUsd ?? 0 },
        storageCostUsd: { increment: costs.storageCostUsd ?? 0 },
        ocrCostUsd: { increment: costs.ocrCostUsd ?? 0 },
        exportCostUsd: { increment: costs.exportCostUsd ?? 0 },
        repairCostUsd: { increment: costs.repairCostUsd ?? 0 },
        cacheSavingsUsd: { increment: costs.cacheSavingsUsd ?? 0 },
        totalCostUsd: { increment: totalCostUsd },
      },
    });
  }
}
