import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '@/prisma/prisma.service';
import { AICreditLedgerService } from '@/ai-credits/ai-credit-ledger.service';
import {
  findDevelopingUsdBasePlan,
  getPricingForCountry,
  isNativeInrPricingCountry,
} from '@/config/pricing.config';
import { computePlanCreditsForTier } from '@/ai-credits/credit-pricing.util';
import { getCountryPricingTier } from '@/config/currency-fx.util';

/**
 * Catches tenants whose Stripe subscription period has rolled over but the
 * `invoice.payment_succeeded` / `customer.subscription.updated` webhook was
 * missed or arrived out of order. Runs daily at 01:00 UTC (offset from
 * FreeDailyGrantScheduler to avoid DB contention at midnight).
 *
 * Logic:
 *  - Find all ACTIVE LAW_FIRM subscriptions whose `currentPeriodEnd` is in
 *    the past AND whose tenantId has no `subscription_renewal` ledger credit
 *    created after that period end.
 *  - Grant credits from the CountryPricing DB (falling back to seed config).
 *  - Advance the subscription period by 30 days so it does not trigger again
 *    until the next missed cycle.
 */
@Injectable()
export class MonthlyTenantGrantScheduler {
  private readonly logger = new Logger(MonthlyTenantGrantScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly creditLedger: AICreditLedgerService,
  ) {}

  @Cron('0 1 * * *', { name: 'monthly-tenant-credit-grant', timeZone: 'UTC' })
  async grantLapsedTenantCredits() {
    const now = new Date();

    // Find active subscriptions whose billing period has lapsed
    const lapsedSubs = await this.prisma.subscription.findMany({
      where: {
        userType: 'LAW_FIRM',
        status: 'ACTIVE',
        tenantId: { not: null },
        currentPeriodEnd: { lt: now },
      },
      select: {
        id: true,
        tenantId: true,
        planId: true,
        countryCode: true,
        currentPeriodEnd: true,
      },
    });

    if (lapsedSubs.length === 0) {
      this.logger.debug('Monthly tenant grant: no lapsed subscriptions found.');
      return;
    }

    let granted = 0;
    let skipped = 0;

    for (const sub of lapsedSubs) {
      if (!sub.tenantId) continue;

      // Skip if a renewal credit already exists after the period end
      const existingRenewal = await this.prisma.aICreditLedger.findFirst({
        where: {
          tenantId: sub.tenantId,
          taskType: 'subscription_renewal',
          eventType: 'CREDIT',
          createdAt: { gt: sub.currentPeriodEnd! },
        },
      });

      if (existingRenewal) {
        skipped++;
        continue;
      }

      // Resolve credits: DB-first, then in-memory seed fallback
      const credits = await this.resolveCredits(sub.planId, sub.countryCode);
      if (credits <= 0) {
        skipped++;
        continue;
      }

      await this.creditLedger.credit({
        tenantId: sub.tenantId,
        taskType: 'subscription_renewal',
        credits,
        metadata: {
          subscriptionId: sub.id,
          planId: sub.planId,
          countryCode: sub.countryCode,
          source: 'monthly-tenant-grant-scheduler',
          lapsedPeriodEnd: sub.currentPeriodEnd,
        },
      });

      // Advance the period by 30 days so it won't fire again until next cycle
      const newPeriodStart = sub.currentPeriodEnd ?? now;
      const newPeriodEnd = new Date(newPeriodStart);
      newPeriodEnd.setDate(newPeriodEnd.getDate() + 30);

      await this.prisma.subscription.update({
        where: { id: sub.id },
        data: { currentPeriodStart: newPeriodStart, currentPeriodEnd: newPeriodEnd },
      });

      this.logger.log(
        `Monthly tenant grant: granted ${credits} credits to tenant ${sub.tenantId} ` +
        `(${sub.planId}/${sub.countryCode}), next period ends ${newPeriodEnd.toISOString().split('T')[0]}`,
      );
      granted++;
    }

    this.logger.log(
      `Monthly tenant grant complete: ${granted} tenants credited, ${skipped} skipped.`,
    );
  }

  private async resolveCredits(planId: string, countryCode: string): Promise<number> {
    // 1. CountryPricing DB (most accurate — country-localized)
    const dbRow = await this.prisma.countryPricing.findFirst({
      where: { planId, countryCode, isActive: true },
    });
    if (dbRow && dbRow.aiCredits > 0) {
      return dbRow.aiCredits;
    }

    // 2. Native country seed (e.g. India INR)
    if (isNativeInrPricingCountry(countryCode)) {
      const native = getPricingForCountry(countryCode, 'LAW_FIRM', planId);
      if (native?.aiCredits) return native.aiCredits;
    }

    // 3. USD developing base + tier multiplier for other markets
    const seed = findDevelopingUsdBasePlan('LAW_FIRM', planId);
    if (!seed) return 0;

    const tier = getCountryPricingTier(countryCode);
    const tierBudgetPercent = tier >= 2 ? 50 : 60;
    const usdEquivalent = Number(seed.amount) * tier;
    return usdEquivalent > 0
      ? computePlanCreditsForTier(usdEquivalent, tierBudgetPercent)
      : seed.aiCredits;
  }
}
