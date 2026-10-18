import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AiModelMode } from '@/ai/premium-models.config';
import { PrismaService } from '@/prisma/prisma.service';
import { getCreditCost } from './credit-costs';
import { AICreditLedgerService } from './ai-credit-ledger.service';
import { PremiumAllowanceService } from './premium-allowance.service';
import { TokenCreditChargeService } from './token-credit-charge.service';

export interface AiUsageAccessCheck {
  allowed: boolean;
  estimatedCredits: number;
  balance: number;
  premiumAllowanceRemaining: number;
  topUpBalance: number;
  reason?: string;
  /** When true, the caller must swap to the Auto model for this request. */
  effectiveModelMode?: 'AUTO' | 'PREMIUM';
  /** Metadata flag for ledger analytics — premium was requested but allowance was exhausted. */
  downgradedFromPremium?: boolean;
}

@Injectable()
export class AiCreditEnforcementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: AICreditLedgerService,
    private readonly premiumAllowance: PremiumAllowanceService,
    private readonly tokenCreditCharge: TokenCreditChargeService,
  ) {}

  estimateCreditsForModel(params: {
    modelName: string;
    inputTokens?: number;
    outputTokens?: number;
  }) {
    return this.tokenCreditCharge.estimateCreditsForModel({
      modelName: params.modelName,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      minCredits: 1,
    });
  }

  async checkUsageAccess(params: {
    userId?: string;
    tenantId?: string;
    modelMode: AiModelMode;
    modelName: string;
    planCreditsMonthly: number;
    cycleStart: Date;
    inputTokens?: number;
    outputTokens?: number;
  }): Promise<AiUsageAccessCheck> {
    const estimate = this.estimateCreditsForModel({
      modelName: params.modelName,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
    });

    const balance = await this.ledger.getBalance({
      userId: params.userId,
      tenantId: params.tenantId,
    });

    const usedThisCycle = await this.getDebitsSinceCycleStart(params);
    const planRemaining = Math.max(0, params.planCreditsMonthly - usedThisCycle);
    const topUpBalance = Math.max(0, balance - planRemaining);

    const premiumAllowanceRemaining =
      await this.premiumAllowance.getPremiumAllowanceRemaining({
        userId: params.userId,
        tenantId: params.tenantId,
        planCreditsMonthly: params.planCreditsMonthly,
        cycleStart: params.cycleStart,
      });

    // Allow if the user can cover 85% of the pre-flight estimate — the estimate
    // uses conservative token assumptions (60% of maxOutputTokens) so a small
    // headroom here prevents false-positive blocks caused by token rounding.
    const requiredBalance = Math.ceil(estimate.credits * 0.85);
    if (balance < requiredBalance) {
      return {
        allowed: false,
        estimatedCredits: estimate.credits,
        balance,
        premiumAllowanceRemaining,
        topUpBalance,
        reason:
          balance === 0
            ? "You've used all your free daily AI credits. Subscribe to continue, or wait until tomorrow for your credits to reset."
            : `Insufficient AI credits (${balance} available, ~${estimate.credits} required). Subscribe or wait for your daily credits to reset.`,
      };
    }

    if (params.modelMode === 'PREMIUM') {
      const premiumPoolAvailable = Math.max(premiumAllowanceRemaining, topUpBalance);
      if (premiumPoolAvailable < estimate.credits) {
        // Silent downgrade to Auto instead of blocking the request.
        // The caller (AI gateway) must respect effectiveModelMode and swap the model.
        // downgradedFromPremium is recorded in ledger metadata for cost analytics.
        return {
          allowed: true,
          estimatedCredits: estimate.credits,
          balance,
          premiumAllowanceRemaining,
          topUpBalance,
          effectiveModelMode: 'AUTO',
          downgradedFromPremium: true,
        };
      }
    }

    return {
      allowed: true,
      estimatedCredits: estimate.credits,
      balance,
      premiumAllowanceRemaining,
      topUpBalance,
      effectiveModelMode: params.modelMode === 'PREMIUM' ? 'PREMIUM' : 'AUTO',
      downgradedFromPremium: false,
    };
  }

  async assertCanUseAi(params: {
    userId?: string;
    tenantId?: string;
    modelMode: AiModelMode;
    modelName: string;
    planCreditsMonthly: number;
    cycleStart: Date;
    inputTokens?: number;
    outputTokens?: number;
  }): Promise<AiUsageAccessCheck> {
    const check = await this.checkUsageAccess(params);
    if (!check.allowed) {
      // Surface user-friendly message, never expose internal model/cost details.
      const message = check.reason?.includes('Subscribe')
        ? "You've used your AI credits for today. Subscribe to continue or wait for your daily reset."
        : "You're out of AI credits. Top up to keep working.";
      throw new ForbiddenException(message);
    }
    return check;
  }

  async debitForTokenUsage(params: {
    userId?: string;
    tenantId?: string;
    taskType: string;
    modelName: string;
    inputTokens: number;
    outputTokens: number;
    metadata?: Prisma.InputJsonValue;
  }) {
    const usageCharge = await this.tokenCreditCharge.computeCreditsForUsage({
      modelName: params.modelName,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      taskType: params.taskType,
      minCredits: getCreditCost(params.taskType),
      tenantId: params.tenantId,
      userId: params.userId,
    });

    const balance = await this.ledger.getBalance({
      userId: params.userId,
      tenantId: params.tenantId,
    });

    if (balance < usageCharge.credits) {
      throw new ForbiddenException(
        `Insufficient AI credits (${balance} available, ${usageCharge.credits} required after token usage). Purchase more credits to continue.`,
      );
    }

    const baseMetadata =
      params.metadata &&
      typeof params.metadata === 'object' &&
      !Array.isArray(params.metadata)
        ? (params.metadata as Record<string, unknown>)
        : {};

    const debitResult = await this.ledger.assertAndDebit({
      userId: params.userId,
      tenantId: params.tenantId,
      taskType: params.taskType,
      credits: usageCharge.credits,
      metadata: {
        ...baseMetadata,
        modelName: params.modelName,
        inputTokens: params.inputTokens,
        outputTokens: params.outputTokens,
        providerCostUsd: usageCharge.providerCostUsd,
        netMarginPercent: usageCharge.netMarginPercent,
        chargeMode: 'token_based',
      } as Prisma.InputJsonValue,
    });

    return {
      ...debitResult,
      usageCharge,
    };
  }

  private async getDebitsSinceCycleStart(params: {
    userId?: string;
    tenantId?: string;
    cycleStart: Date;
  }): Promise<number> {
    const entries = await this.prisma.aICreditLedger.findMany({
      where: {
        userId: params.userId,
        tenantId: params.tenantId,
        eventType: 'DEBIT',
        createdAt: { gte: params.cycleStart },
      },
    });
    return entries.reduce((sum, entry) => sum + entry.credits, 0);
  }
}
