import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class AIBudgetPolicyService {
  constructor(private readonly prisma: PrismaService) {}

  computeMaxAiBudget(mrrUsd: number, targetNetMargin = 0.40): number {
    const clampedMargin = Math.min(Math.max(targetNetMargin, 0), 0.95);
    const nonAiCostShare = 0.25;
    const maxAiSpend = mrrUsd * (1 - clampedMargin - nonAiCostShare);
    return Math.max(0, Number(maxAiSpend.toFixed(4)));
  }

  async upsertPolicy(params: {
    tenantId?: string;
    userId?: string;
    mrrUsd: number;
    targetNetMargin?: number;
  }) {
    const targetNetMargin = params.targetNetMargin ?? 0.4;
    const monthlyBudgetUsd = this.computeMaxAiBudget(params.mrrUsd, targetNetMargin);

    const existing = await this.prisma.aIBudgetPolicy.findFirst({
      where: {
        tenantId: params.tenantId,
        userId: params.userId,
      },
    });

    const maxCostPerTaskUsd = Math.min(
      Number((monthlyBudgetUsd * 0.05).toFixed(4)),
      0.25,
    );

    const data = {
      mrrUsd: new Prisma.Decimal(params.mrrUsd),
      targetNetMargin: new Prisma.Decimal(targetNetMargin),
      monthlyBudgetUsd: new Prisma.Decimal(monthlyBudgetUsd),
      dailyBudgetUsd: new Prisma.Decimal(Number((monthlyBudgetUsd / 30).toFixed(4))),
      maxCostPerTaskUsd: new Prisma.Decimal(maxCostPerTaskUsd),
    };

    if (existing) {
      return this.prisma.aIBudgetPolicy.update({
        where: { id: existing.id },
        data,
      });
    }

    return this.prisma.aIBudgetPolicy.create({
      data: {
        tenantId: params.tenantId,
        userId: params.userId,
        ...data,
      },
    });
  }

  async getPolicy(params: { tenantId?: string; userId?: string }) {
    return this.prisma.aIBudgetPolicy.findFirst({
      where: {
        tenantId: params.tenantId,
        userId: params.userId,
      },
    });
  }
}
