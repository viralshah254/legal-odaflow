import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getPlanNetMarginPercent } from '@/config/billing-plans';
import {
  computeAiBudgetUsd,
  computeCreditsFromPayment,
  DEFAULT_CREDIT_USD_VALUE,
} from './credit-pricing.util';

@Injectable()
export class CreditPricingService {
  private readonly logger = new Logger(CreditPricingService.name);

  constructor(private readonly configService: ConfigService) {
    // Boot-time consistency check: the credit USD value used for charging must
    // match the value used for granting credits at subscription time.
    // A mismatch silently inflates or deflates all margin calculations.
    const runtimeValue = this.getCreditUsdValue();
    if (runtimeValue !== DEFAULT_CREDIT_USD_VALUE) {
      this.logger.warn(
        `AI_CREDIT_USD_VALUE=${runtimeValue} differs from DEFAULT_CREDIT_USD_VALUE=${DEFAULT_CREDIT_USD_VALUE}. ` +
          `This will cause margin calculations to be incorrect. Set AI_CREDIT_USD_VALUE=${DEFAULT_CREDIT_USD_VALUE} in your environment.`,
      );
    }
  }

  getPlatformMarginPercent(billingPlan?: string | null): number {
    if (billingPlan) {
      return getPlanNetMarginPercent(billingPlan);
    }
    return Number(
      this.configService.get<string>('AI_PLATFORM_MARGIN_PERCENT', '40'),
    );
  }

  getPlatformMargin(billingPlan?: string | null): number {
    return this.getPlatformMarginPercent(billingPlan) / 100;
  }

  getCreditUsdValue(): number {
    // One credit represents $0.01 of customer usage charges.
    // Must match credit-pricing.util.ts::DEFAULT_CREDIT_USD_VALUE.
    const value = Number(this.configService.get<string>('AI_CREDIT_USD_VALUE', '0.01'));
    if (!Number.isFinite(value) || value <= 0) throw new Error('Invalid AI_CREDIT_USD_VALUE');
    return value;
  }

  getNetMarginPercent(_billingPlan?: string | null): number {
    // Twice provider cost is a 100% markup / 50% gross margin.
    return 50;
  }

  computeAiBudgetUsd(paymentUsd: number, billingPlan?: string | null): number {
    return computeAiBudgetUsd(paymentUsd, this.getPlatformMarginPercent(billingPlan));
  }

  computeCreditsFromPayment(paymentUsd: number, billingPlan?: string | null): number {
    return computeCreditsFromPayment(
      paymentUsd,
      this.getCreditUsdValue(),
      this.getPlatformMarginPercent(billingPlan),
    );
  }

  computeCreditValueUsd(credits: number): number {
    return Number((credits * this.getCreditUsdValue()).toFixed(6));
  }
}
