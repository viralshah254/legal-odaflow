import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { getTenantPlanCreditAllowance, normalizeBillingPlan } from '@/config/billing-plans';
import { PrismaService } from '@/prisma/prisma.service';
import { RealtimePublisherService } from '@/realtime/realtime-publisher.service';
import { REALTIME_EVENTS } from '@/realtime/realtime-events';
import { getCreditCost } from './credit-costs';

export interface CreditLedgerInput {
  userId?: string;
  tenantId?: string;
  taskType: string;
  credits: number;
  costUsd?: number;
  metadata?: Prisma.InputJsonValue;
}

@Injectable()
export class AICreditLedgerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimePublisherService,
  ) {}

  async credit(input: CreditLedgerInput) {
    const entry = await this.prisma.aICreditLedger.create({
      data: {
        userId: input.userId,
        tenantId: input.tenantId,
        eventType: 'CREDIT',
        taskType: input.taskType,
        credits: input.credits,
        costUsd: input.costUsd !== undefined ? new Prisma.Decimal(input.costUsd) : undefined,
        metadata: input.metadata,
      },
    });

    if (input.userId && !input.tenantId) {
      await this.prisma.consumerProfile.updateMany({
        where: { userId: input.userId },
        data: { aiCreditsRemaining: { increment: input.credits } },
      });
    }

    if (input.tenantId) {
      await this.prisma.tenant.update({
        where: { id: input.tenantId },
        data: { aiCreditsRemaining: { increment: input.credits } },
      });
    }

    return entry;
  }

  async debit(input: CreditLedgerInput) {
    return this.prisma.aICreditLedger.create({
      data: {
        userId: input.userId,
        tenantId: input.tenantId,
        eventType: 'DEBIT',
        taskType: input.taskType,
        credits: input.credits,
        costUsd: input.costUsd !== undefined ? new Prisma.Decimal(input.costUsd) : undefined,
        metadata: input.metadata,
      },
    });
  }

  async getLedgerBalance(params: { userId?: string; tenantId?: string }): Promise<number> {
    const where = {
      userId: params.userId,
      tenantId: params.tenantId,
    };

    const entries = await this.prisma.aICreditLedger.findMany({ where });
    return entries.reduce(
      (sum, entry) => sum + (entry.eventType === 'CREDIT' ? entry.credits : -entry.credits),
      0,
    );
  }

  async getBalance(params: { userId?: string; tenantId?: string }): Promise<number> {
    const ledgerBalance = await this.getLedgerBalance(params);

    if (params.userId && !params.tenantId) {
      const profile = await this.prisma.consumerProfile.findUnique({
        where: { userId: params.userId },
      });
      if (profile) {
        return Math.max(ledgerBalance, profile.aiCreditsRemaining);
      }
    }

    if (params.tenantId) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: params.tenantId },
        select: { aiCreditsRemaining: true, billingPlan: true },
      });
      if (tenant) {
        return Math.max(ledgerBalance, tenant.aiCreditsRemaining);
      }
    }

    return ledgerBalance;
  }

  async assertAndDebit(params: {
    userId?: string;
    tenantId?: string;
    taskType: string;
    credits?: number;
    metadata?: Prisma.InputJsonValue;
  }) {
    const cost = params.credits ?? getCreditCost(params.taskType);
    const balance = await this.getBalance({
      userId: params.userId,
      tenantId: params.tenantId,
    });

    if (balance < cost) {
      throw new ForbiddenException(
        `Insufficient AI credits (${balance} available, ${cost} required for ${params.taskType})`,
      );
    }

    const entry = await this.debit({
      userId: params.userId,
      tenantId: params.tenantId,
      taskType: params.taskType,
      credits: cost,
      metadata: params.metadata,
    });

    if (params.userId && !params.tenantId) {
      const profile = await this.prisma.consumerProfile.findUnique({
        where: { userId: params.userId },
      });
      if (profile && profile.aiCreditsRemaining >= cost) {
        await this.prisma.consumerProfile.update({
          where: { userId: params.userId },
          data: { aiCreditsRemaining: { decrement: cost } },
        });
      }
    }

    if (params.tenantId) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: params.tenantId },
        select: { aiCreditsRemaining: true },
      });
      if (tenant && tenant.aiCreditsRemaining >= cost) {
        await this.prisma.tenant.update({
          where: { id: params.tenantId },
          data: { aiCreditsRemaining: { decrement: cost } },
        });
      }
    }

    const result = { entry, creditsDebited: cost, balanceAfter: balance - cost };
    this.publishCreditBalanceUpdate(params, result.balanceAfter);
    return result;
  }

  private publishCreditBalanceUpdate(
    params: { userId?: string; tenantId?: string },
    balanceAfter: number,
  ) {
    if (params.tenantId) {
      this.realtime.publishToTenant(
        params.tenantId,
        REALTIME_EVENTS.CREDIT_BALANCE_UPDATED,
        {
          entityId: params.tenantId,
          action: 'updated',
          data: { balance: balanceAfter },
          userId: params.userId,
        },
      );
    }
  }

  async assertSufficientBalance(params: {
    userId?: string;
    tenantId?: string;
    taskType: string;
  }) {
    const cost = getCreditCost(params.taskType);
    const balance = await this.getBalance(params);
    if (balance < cost) {
      throw new ForbiddenException(
        `Insufficient AI credits (${balance} available, ${cost} required for ${params.taskType})`,
      );
    }
    return { balance, cost };
  }

  async getPlanAllowance(params: { userId?: string; tenantId?: string }): Promise<number> {
    if (params.tenantId) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: params.tenantId },
        select: { billingPlan: true },
      });
      return getTenantPlanCreditAllowance(tenant?.billingPlan);
    }

    if (params.userId) {
      const profile = await this.prisma.consumerProfile.findUnique({
        where: { userId: params.userId },
      });
      return profile?.aiCreditsRemaining ?? 3;
    }

    return 0;
  }

  normalizeTenantBillingPlan(billingPlan?: string | null) {
    return normalizeBillingPlan(billingPlan);
  }
}
