import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

export interface WorkflowCostEntry {
  retrievalCostUsd?: number;
  modelCostUsd?: number;
  storageCostUsd?: number;
  ocrCostUsd?: number;
  exportCostUsd?: number;
  repairCostUsd?: number;
  cacheSavingsUsd?: number;
}

@Injectable()
export class CostLedgerService {
  constructor(private readonly prisma: PrismaService) {}

  async initWorkflow(
    workflowId: string,
    tenantId: string,
    userId: string,
    feature: string,
  ) {
    return this.prisma.workflowCostLedger.create({
      data: { workflowId, tenantId, userId, feature },
    });
  }

  async addCost(
    workflowId: string,
    tenantId: string,
    entry: WorkflowCostEntry,
  ) {
    const current = await this.prisma.workflowCostLedger.findFirst({
      where: { workflowId, tenantId },
    });

    if (!current) {
      throw new Error(
        `WorkflowCostLedger not found for workflowId: ${workflowId}, tenantId: ${tenantId}`,
      );
    }

    const retrievalCostUsd = current.retrievalCostUsd + (entry.retrievalCostUsd ?? 0);
    const modelCostUsd = current.modelCostUsd + (entry.modelCostUsd ?? 0);
    const storageCostUsd = current.storageCostUsd + (entry.storageCostUsd ?? 0);
    const ocrCostUsd = current.ocrCostUsd + (entry.ocrCostUsd ?? 0);
    const exportCostUsd = current.exportCostUsd + (entry.exportCostUsd ?? 0);
    const repairCostUsd = current.repairCostUsd + (entry.repairCostUsd ?? 0);
    const cacheSavingsUsd = current.cacheSavingsUsd + (entry.cacheSavingsUsd ?? 0);
    const totalCostUsd = Math.max(
      0,
      retrievalCostUsd +
        modelCostUsd +
        storageCostUsd +
        ocrCostUsd +
        exportCostUsd +
        repairCostUsd -
        cacheSavingsUsd,
    );

    return this.prisma.workflowCostLedger.update({
      where: { workflowId },
      data: {
        retrievalCostUsd,
        modelCostUsd,
        storageCostUsd,
        ocrCostUsd,
        exportCostUsd,
        repairCostUsd,
        cacheSavingsUsd,
        totalCostUsd,
      },
    });
  }

  async getWorkflowCost(workflowId: string, tenantId: string) {
    return this.prisma.workflowCostLedger.findFirst({
      where: { workflowId, tenantId },
    });
  }

  async getTenantSpend(tenantId: string, startDate: Date, endDate: Date) {
    return this.prisma.workflowCostLedger.aggregate({
      where: {
        tenantId,
        createdAt: { gte: startDate, lte: endDate },
      },
      _sum: {
        totalCostUsd: true,
        modelCostUsd: true,
        retrievalCostUsd: true,
        storageCostUsd: true,
        ocrCostUsd: true,
        exportCostUsd: true,
        repairCostUsd: true,
        cacheSavingsUsd: true,
      },
      _count: { id: true },
    });
  }

  async getFeatureSpend(
    tenantId: string,
    feature: string,
    startDate: Date,
    endDate: Date,
  ) {
    return this.prisma.workflowCostLedger.aggregate({
      where: {
        tenantId,
        feature,
        createdAt: { gte: startDate, lte: endDate },
      },
      _sum: {
        totalCostUsd: true,
        modelCostUsd: true,
        retrievalCostUsd: true,
        storageCostUsd: true,
        ocrCostUsd: true,
        exportCostUsd: true,
        repairCostUsd: true,
        cacheSavingsUsd: true,
      },
      _count: { id: true },
    });
  }
}
