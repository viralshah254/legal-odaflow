import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';

export interface AiUsageLogInput {
  userId?: string;
  tenantId?: string;
  consumerCaseId?: string;
  matterId?: string;
  taskType: string;
  mode: string;
  modelProvider: string;
  modelName: string;
  modelTier?: string;
  inputTokens?: number;
  outputTokens?: number;
  retrievalCount?: number;
  costUsd?: number;
  estimatedCostUsd?: number;
  chargedCredits?: number;
  creditValueUsd?: number;
  platformMarginUsd?: number;
  latencyMs?: number;
  status: string;
  error?: string;
}

export interface AiUsageAggregateFilters {
  tenantId?: string;
  userId?: string;
  from?: Date;
  to?: Date;
}

@Injectable()
export class AiUsageService {
  constructor(private readonly prisma: PrismaService) {}

  async logUsage(input: AiUsageLogInput) {
    return this.prisma.aIUsageLog.create({
      data: {
        userId: input.userId,
        tenantId: input.tenantId,
        consumerCaseId: input.consumerCaseId,
        matterId: input.matterId,
        taskType: input.taskType,
        mode: input.mode,
        modelProvider: input.modelProvider,
        modelName: input.modelName,
        modelTier: input.modelTier,
        inputTokens: input.inputTokens ?? 0,
        outputTokens: input.outputTokens ?? 0,
        retrievalCount: input.retrievalCount ?? 0,
        costUsd: input.costUsd !== undefined ? new Prisma.Decimal(input.costUsd) : undefined,
        estimatedCostUsd:
          input.estimatedCostUsd !== undefined
            ? new Prisma.Decimal(input.estimatedCostUsd)
            : undefined,
        chargedCredits: input.chargedCredits ?? 0,
        creditValueUsd:
          input.creditValueUsd !== undefined
            ? new Prisma.Decimal(input.creditValueUsd)
            : undefined,
        platformMarginUsd:
          input.platformMarginUsd !== undefined
            ? new Prisma.Decimal(input.platformMarginUsd)
            : undefined,
        latencyMs: input.latencyMs,
        status: input.status,
        error: input.error,
      },
    });
  }

  private startOfMonth(): Date {
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  async getMonthlyConsumerSpend(userId: string): Promise<number> {
    const aggregate = await this.prisma.aIUsageLog.aggregate({
      where: {
        userId,
        createdAt: { gte: this.startOfMonth() },
        status: 'SUCCESS',
      },
      _sum: { costUsd: true },
    });

    return Number(aggregate._sum.costUsd ?? 0);
  }

  async getMonthlyTenantSpend(tenantId: string): Promise<number> {
    const aggregate = await this.prisma.aIUsageLog.aggregate({
      where: {
        tenantId,
        createdAt: { gte: this.startOfMonth() },
        status: 'SUCCESS',
      },
      _sum: { costUsd: true },
    });

    return Number(aggregate._sum.costUsd ?? 0);
  }

  async getUsageSummary(filters: AiUsageAggregateFilters) {
    const where = {
      tenantId: filters.tenantId,
      userId: filters.userId,
      createdAt:
        filters.from || filters.to
          ? {
              gte: filters.from,
              lte: filters.to,
            }
          : undefined,
    };

    const [aggregate, byTaskType, recentLogs] = await Promise.all([
      this.prisma.aIUsageLog.aggregate({
        where,
        _count: { id: true },
        _sum: {
          inputTokens: true,
          outputTokens: true,
          costUsd: true,
        },
      }),
      this.prisma.aIUsageLog.groupBy({
        by: ['taskType'],
        where,
        _count: { id: true },
        _sum: { costUsd: true, inputTokens: true, outputTokens: true },
      }),
      this.prisma.aIUsageLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    return {
      totalRequests: aggregate._count.id,
      totalInputTokens: aggregate._sum.inputTokens ?? 0,
      totalOutputTokens: aggregate._sum.outputTokens ?? 0,
      totalCostUsd: Number(aggregate._sum.costUsd ?? 0),
      byMode: byTaskType.map((row) => ({
        taskType: row.taskType,
        mode: row.taskType,
        count: row._count.id,
        costUsd: Number(row._sum.costUsd ?? 0),
      })),
      byTaskType: byTaskType.map((row) => ({
        taskType: row.taskType,
        requests: row._count.id,
        inputTokens: row._sum.inputTokens ?? 0,
        outputTokens: row._sum.outputTokens ?? 0,
        costUsd: Number(row._sum.costUsd ?? 0),
      })),
      recentLogs,
    };
  }
}
