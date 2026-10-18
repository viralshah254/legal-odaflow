/**
 * AiCycleMarginGuardService — blended 40% AI margin per user/tenant billing cycle.
 *
 * Individual AI calls are allowed to dip below 40% margin, but cumulative provider
 * spend within a billing cycle must not exceed 60% of the subscription revenue for
 * that period (= 40% blended gross margin).
 *
 * Guard levels:
 *   < 80% of AI budget used  → run as routed (no change)
 *   80–100% of AI budget     → force AUTO/cheap tier (silently downgrade PREMIUM)
 *   >= 100% of AI budget     → block premium; allow only cheap/auto or prompt top-up
 *
 * "AI budget" per cycle = subscriptionRevenueUsd × (1 − TARGET_MARGIN).
 * For a $50/mo subscription at 40% margin → $30 AI budget.
 *
 * This guard is a soft runtime control. It does NOT affect credit grant math (that
 * is handled at subscription activation). It prevents a few heavy users from
 * burning through disproportionate API spend within their cycle.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { getPlanNetMarginPercent } from '@/config/billing-plans';

export type CycleMarginStatus = 'ok' | 'approaching_limit' | 'at_limit';

export interface CycleMarginResult {
  status: CycleMarginStatus;
  /** Actual AI provider spend so far this cycle in USD. */
  cycleSpendUsd: number;
  /** Allowed AI budget for this cycle in USD. */
  cycleBudgetUsd: number;
  /** 0–100: how much of the AI budget has been consumed. */
  budgetUsedPercent: number;
  /**
   * When status = approaching_limit or at_limit, the recommended quality mode
   * to use to keep the cycle profitable.
   */
  recommendedMode: 'AUTO' | 'PREMIUM';
}

/** Target blended gross margin for the platform (minimum enforced per cycle). */
const TARGET_MARGIN_PERCENT = 40;

/**
 * Fraction of cycle AI budget that triggers the "approaching limit" auto-downgrade.
 * At 80% budget consumption we force AUTO mode for premium users.
 */
const DOWNGRADE_THRESHOLD = 0.80;

@Injectable()
export class AiCycleMarginGuardService {
  private readonly logger = new Logger(AiCycleMarginGuardService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Evaluate the cycle margin status for a tenant or user.
   *
   * @param params.tenantId  — Firm/tenant ID (primary identifier for B2B users)
   * @param params.userId    — User ID (fallback for consumer accounts)
   * @returns CycleMarginResult with status and recommended model mode
   */
  async evaluate(params: {
    tenantId?: string;
    userId?: string;
  }): Promise<CycleMarginResult> {
    const { cycleStart, cycleEnd } = this.getCurrentCycleBounds();

    // Compute actual AI provider spend this cycle from AIUsageLog
    const spendAggregate = await this.prisma.aIUsageLog.aggregate({
      _sum: { costUsd: true },
      where: {
        createdAt: { gte: cycleStart, lte: cycleEnd },
        ...(params.tenantId ? { tenantId: params.tenantId } : {}),
        ...(params.userId && !params.tenantId ? { userId: params.userId } : {}),
      },
    });

    const cycleSpendUsd = Number(spendAggregate._sum.costUsd ?? 0);

    // Determine the subscription revenue for this cycle
    const cycleBudgetUsd = await this.getCycleAiBudget(params, cycleStart, cycleEnd);

    const budgetUsedPercent =
      cycleBudgetUsd > 0 ? Math.round((cycleSpendUsd / cycleBudgetUsd) * 100) : 0;

    let status: CycleMarginStatus;
    let recommendedMode: 'AUTO' | 'PREMIUM';

    if (budgetUsedPercent >= 100) {
      status = 'at_limit';
      recommendedMode = 'AUTO';
      this.logger.warn(
        `Cycle AI budget exhausted for ${params.tenantId ?? params.userId}: ` +
          `spent $${cycleSpendUsd.toFixed(4)} of $${cycleBudgetUsd.toFixed(4)} budget (${budgetUsedPercent}%)`,
      );
    } else if (budgetUsedPercent >= DOWNGRADE_THRESHOLD * 100) {
      status = 'approaching_limit';
      recommendedMode = 'AUTO';
    } else {
      status = 'ok';
      recommendedMode = 'PREMIUM'; // no restriction
    }

    return { status, cycleSpendUsd, cycleBudgetUsd, budgetUsedPercent, recommendedMode };
  }

  /**
   * Quick guard: resolve the effective model mode for a draft request.
   * If the cycle budget is >=80% consumed, forces AUTO regardless of what the
   * user requested. Returns the effective mode to use.
   */
  async resolveEffectiveMode(
    params: { tenantId?: string; userId?: string },
    requestedMode: 'AUTO' | 'PREMIUM' = 'AUTO',
  ): Promise<{ effectiveMode: 'AUTO' | 'PREMIUM'; guardTriggered: boolean }> {
    if (requestedMode === 'AUTO') {
      return { effectiveMode: 'AUTO', guardTriggered: false };
    }

    try {
      const result = await this.evaluate(params);
      if (result.status !== 'ok') {
        return { effectiveMode: 'AUTO', guardTriggered: true };
      }
    } catch (err) {
      // Never block on guard failure — log and allow through
      this.logger.warn(
        `CycleMarginGuard evaluation failed, allowing PREMIUM: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    return { effectiveMode: requestedMode, guardTriggered: false };
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private getCurrentCycleBounds(): { cycleStart: Date; cycleEnd: Date } {
    const now = new Date();
    const cycleStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const cycleEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { cycleStart, cycleEnd };
  }

  private async getCycleAiBudget(
    params: { tenantId?: string; userId?: string },
    cycleStart: Date,
    cycleEnd: Date,
  ): Promise<number> {
    // AI budget = cycleCreditsGranted × AI_CREDIT_USD_VALUE
    //
    // Credits granted this cycle via subscription_activation or subscription_renewal
    // already encode the margin: planRevenue × (1 − margin) = creditGrant × creditUsdValue.
    // Comparing actual provider spend against this budget enforces blended 40% margin.
    //
    // Credit USD value = $0.01 (DEFAULT_CREDIT_USD_VALUE / AI_CREDIT_USD_VALUE env).
    const CREDIT_USD_VALUE = 0.01;

    const grantAggregate = await this.prisma.aICreditLedger.aggregate({
      _sum: { credits: true },
      where: {
        createdAt: { gte: cycleStart, lte: cycleEnd },
        eventType: 'CREDIT',
        taskType: { in: ['subscription_activation', 'subscription_renewal', 'credit_topup'] },
        ...(params.tenantId ? { tenantId: params.tenantId } : {}),
        ...(params.userId && !params.tenantId ? { userId: params.userId } : {}),
      },
    });

    const cycleCredits = Number(grantAggregate._sum.credits ?? 0);

    if (cycleCredits > 0) {
      return cycleCredits * CREDIT_USD_VALUE;
    }

    // Fallback: use billing-plan tier to estimate budget
    const billingPlan = params.tenantId
      ? await this.getTenantBillingPlan(params.tenantId)
      : null;

    const planMargin = getPlanNetMarginPercent(billingPlan);
    const effectiveMargin = Math.max(TARGET_MARGIN_PERCENT, planMargin) / 100;

    // Use the `aiCreditsRemaining` balance as a proxy for cycle grant
    if (params.tenantId) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: params.tenantId },
        select: { aiCreditsRemaining: true },
      });
      if (tenant && tenant.aiCreditsRemaining > 0) {
        // Remaining credits ≤ cycle grant; use as lower-bound estimate
        const estimatedBudget = tenant.aiCreditsRemaining * CREDIT_USD_VALUE / (1 - effectiveMargin);
        return Math.max(5, estimatedBudget * (1 - effectiveMargin));
      }
    }

    // Last resort: use monthly cost cap × (1 − margin)
    const fallbackCapUsd = params.tenantId ? 500 : 25;
    return fallbackCapUsd * (1 - effectiveMargin);
  }

  private async getTenantBillingPlan(tenantId: string): Promise<string | null> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { billingPlan: true },
    });
    return tenant?.billingPlan ?? null;
  }
}
