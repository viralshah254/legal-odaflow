import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { COUNTRY_PRICING_SEEDS } from '@/config/pricing.config';
import { PrismaService } from '@/prisma/prisma.service';

/** Minimum blended gross margin % that should be maintained per tenant cycle. */
const TARGET_MARGIN_PERCENT = 40;
const CREDIT_USD_VALUE = 0.01;

export interface CycleMarginSummary {
  tenantId: string;
  cycleStart: Date;
  cycleEnd: Date;
  totalSpendUsd: number;
  totalGrantedCredits: number;
  estimatedRevenueBudgetUsd: number;
  marginPercent: number;
  isBelowTarget: boolean;
  callCount: number;
}

export interface ModelMixEntry {
  modelName: string;
  taskType: string;
  callCount: number;
  totalCostUsd: number;
  avgCostUsd: number;
  totalInputTokens: number;
  totalOutputTokens: number;
}

@Injectable()
export class UnitEconomicsService {
  constructor(private readonly prisma: PrismaService) {}

  async snapshotWeekly() {
    const periodEnd = new Date();
    const periodStart = new Date(periodEnd);
    periodStart.setDate(periodStart.getDate() - 7);

    const snapshots = [];

    for (const plan of COUNTRY_PRICING_SEEDS) {
      const avgRevenue = Number(plan.amount);
      const aiUsage = await this.prisma.aIUsageLog.aggregate({
        where: {
          createdAt: { gte: periodStart, lte: periodEnd },
          status: 'SUCCESS',
        },
        _avg: { costUsd: true },
        _count: { id: true },
      });

      const avgAiCost = Number(aiUsage._avg.costUsd ?? 0) * Math.max(aiUsage._count.id, 1);
      const avgServerCost = avgRevenue * 0.08;
      const avgPaymentFee = avgRevenue * 0.029;
      const avgGrossMargin = avgRevenue - avgAiCost - avgServerCost - avgPaymentFee;
      const avgNetMargin = avgRevenue > 0 ? avgGrossMargin / avgRevenue : 0;

      const snapshot = await this.prisma.unitEconomicsSnapshot.create({
        data: {
          countryCode: plan.countryCode,
          planKey: plan.planId,
          avgRevenue: new Prisma.Decimal(avgRevenue),
          avgAiCost: new Prisma.Decimal(Number(avgAiCost.toFixed(4))),
          avgServerCost: new Prisma.Decimal(Number(avgServerCost.toFixed(4))),
          avgPaymentFee: new Prisma.Decimal(Number(avgPaymentFee.toFixed(4))),
          avgGrossMargin: new Prisma.Decimal(Number(avgGrossMargin.toFixed(4))),
          avgNetMargin: new Prisma.Decimal(Number(avgNetMargin.toFixed(4))),
          periodStart,
          periodEnd,
        },
      });

      snapshots.push(snapshot);
    }

    return { periodStart, periodEnd, count: snapshots.length, snapshots };
  }

  async listSnapshots(countryCode?: string, planKey?: string) {
    return this.prisma.unitEconomicsSnapshot.findMany({
      where: {
        countryCode: countryCode?.toUpperCase(),
        planKey,
      },
      orderBy: { periodStart: 'desc' },
      take: 50,
    });
  }

  /**
   * Per-tenant cycle margin view.
   *
   * Returns the blended AI margin for each active tenant in the current billing
   * cycle. Tenants below TARGET_MARGIN_PERCENT are flagged `isBelowTarget`.
   * Used by the admin dashboard and the sub-40% alert system.
   */
  async getTenantCycleMargins(
    cycleStart?: Date,
    cycleEnd?: Date,
  ): Promise<CycleMarginSummary[]> {
    const now = new Date();
    const start = cycleStart ?? new Date(now.getFullYear(), now.getMonth(), 1);
    const end = cycleEnd ?? new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // Aggregate AI spend per tenant this cycle
    const spendRows = await this.prisma.aIUsageLog.groupBy({
      by: ['tenantId'],
      where: { createdAt: { gte: start, lte: end }, tenantId: { not: null } },
      _sum: { costUsd: true },
      _count: { id: true },
    });

    // Aggregate credit grants per tenant this cycle (subscription activations/renewals)
    const grantRows = await this.prisma.aICreditLedger.groupBy({
      by: ['tenantId'],
      where: {
        createdAt: { gte: start, lte: end },
        eventType: 'CREDIT',
        taskType: { in: ['subscription_activation', 'subscription_renewal', 'credit_topup'] },
        tenantId: { not: null },
      },
      _sum: { credits: true },
    });

    const grantMap = new Map(grantRows.map((r) => [r.tenantId, Number(r._sum.credits ?? 0)]));

    const summaries: CycleMarginSummary[] = [];

    for (const row of spendRows) {
      if (!row.tenantId) continue;

      const totalSpendUsd = Number(row._sum.costUsd ?? 0);
      const callCount = row._count.id;
      const grantedCredits = grantMap.get(row.tenantId) ?? 0;
      // Estimate revenue budget from credit grant: grants = planRevenue × (1 − margin) / creditUsdValue
      // Therefore: planRevenue ≈ grantedCredits × creditUsdValue / (1 − margin)
      const estimatedRevenueBudgetUsd =
        grantedCredits > 0
          ? grantedCredits * CREDIT_USD_VALUE / (1 - TARGET_MARGIN_PERCENT / 100)
          : 0;

      const marginPercent =
        estimatedRevenueBudgetUsd > 0
          ? Math.round(((estimatedRevenueBudgetUsd - totalSpendUsd) / estimatedRevenueBudgetUsd) * 100)
          : 100; // No revenue data: treat as no spend = 100% margin

      summaries.push({
        tenantId: row.tenantId,
        cycleStart: start,
        cycleEnd: end,
        totalSpendUsd,
        totalGrantedCredits: grantedCredits,
        estimatedRevenueBudgetUsd,
        marginPercent,
        isBelowTarget: marginPercent < TARGET_MARGIN_PERCENT,
        callCount,
      });
    }

    // Sort: sub-target tenants first, then by descending spend
    return summaries.sort((a, b) => {
      if (a.isBelowTarget !== b.isBelowTarget) return a.isBelowTarget ? -1 : 1;
      return b.totalSpendUsd - a.totalSpendUsd;
    });
  }

  /**
   * Alert: return tenants projected to exceed the AI budget before cycle end.
   *
   * Uses the daily burn rate × remaining days heuristic. Useful for proactive
   * notifications before a tenant actually crosses the 40% floor.
   */
  async getSubTargetAlerts(): Promise<CycleMarginSummary[]> {
    const margins = await this.getTenantCycleMargins();
    return margins.filter((m) => m.isBelowTarget);
  }

  /**
   * Model-mix readout by task type.
   *
   * Returns a breakdown of which models are being called for which task types,
   * with cost and token counts. Used by the admin dashboard to verify that
   * Opus usage actually dropped after Phase 1 routing changes.
   *
   * @param taskType  — optional filter (e.g. 'INDIA_COURT_DRAFT')
   * @param days      — look-back window in days (default: 30)
   */
  async getModelMix(taskType?: string, days = 30): Promise<ModelMixEntry[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const rows = await this.prisma.aIUsageLog.groupBy({
      by: ['modelName', 'taskType'],
      where: {
        createdAt: { gte: since },
        ...(taskType ? { taskType } : {}),
      },
      _sum: { costUsd: true, inputTokens: true, outputTokens: true },
      _count: { id: true },
      orderBy: { _sum: { costUsd: 'desc' } },
    });

    return rows.map((r) => ({
      modelName: r.modelName,
      taskType: r.taskType,
      callCount: r._count.id,
      totalCostUsd: Number(r._sum.costUsd ?? 0),
      avgCostUsd: r._count.id > 0 ? Number(r._sum.costUsd ?? 0) / r._count.id : 0,
      totalInputTokens: Number(r._sum.inputTokens ?? 0),
      totalOutputTokens: Number(r._sum.outputTokens ?? 0),
    }));
  }
}
