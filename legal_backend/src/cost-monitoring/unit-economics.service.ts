import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { COUNTRY_PRICING_SEEDS } from '@/config/pricing.config';
import { PrismaService } from '@/prisma/prisma.service';

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
}
