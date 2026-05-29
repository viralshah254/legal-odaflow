import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma/prisma.service';

export const PREMIUM_ALLOWANCE_PERCENT = 20;

@Injectable()
export class PremiumAllowanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  getAllowancePercent(): number {
    return Number(
      this.configService.get<string>('AI_PREMIUM_ALLOWANCE_PERCENT', String(PREMIUM_ALLOWANCE_PERCENT)),
    );
  }

  computePremiumAllowance(planCreditsMonthly: number): number {
    const pct = this.getAllowancePercent() / 100;
    return Math.max(0, Math.floor(planCreditsMonthly * pct));
  }

  async getCycleUsage(params: {
    userId?: string;
    tenantId?: string;
    cycleStart: Date;
  }): Promise<{ autoCreditsUsed: number; premiumCreditsUsed: number }> {
    const logs = await this.prisma.aIUsageLog.findMany({
      where: {
        userId: params.userId,
        tenantId: params.tenantId,
        status: 'SUCCESS',
        createdAt: { gte: params.cycleStart },
        chargedCredits: { gt: 0 },
      },
      select: { mode: true, chargedCredits: true },
    });

    let autoCreditsUsed = 0;
    let premiumCreditsUsed = 0;
    for (const log of logs) {
      const mode = (log.mode ?? 'AUTO').toUpperCase();
      if (mode === 'PREMIUM') {
        premiumCreditsUsed += log.chargedCredits;
      } else {
        autoCreditsUsed += log.chargedCredits;
      }
    }
    return { autoCreditsUsed, premiumCreditsUsed };
  }

  async getPremiumAllowanceRemaining(params: {
    userId?: string;
    tenantId?: string;
    planCreditsMonthly: number;
    cycleStart: Date;
  }): Promise<number> {
    const allowance = this.computePremiumAllowance(params.planCreditsMonthly);
    const { premiumCreditsUsed } = await this.getCycleUsage({
      userId: params.userId,
      tenantId: params.tenantId,
      cycleStart: params.cycleStart,
    });
    return Math.max(0, allowance - premiumCreditsUsed);
  }

  async getOnDemandCredits(params: { userId?: string; tenantId?: string }): Promise<number> {
    const entries = await this.prisma.aICreditLedger.findMany({
      where: {
        userId: params.userId,
        tenantId: params.tenantId,
        eventType: 'CREDIT',
        taskType: 'credit_topup',
      },
    });
    return entries.reduce((sum, e) => sum + e.credits, 0);
  }
}
