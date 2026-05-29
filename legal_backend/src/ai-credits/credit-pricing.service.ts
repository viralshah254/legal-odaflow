import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  computeAiBudgetUsd,
  computeCreditsFromPayment,
} from './credit-pricing.util';

@Injectable()
export class CreditPricingService {
  constructor(private readonly configService: ConfigService) {}

  getPlatformMarginPercent(): number {
    return Number(
      this.configService.get<string>('AI_PLATFORM_MARGIN_PERCENT', '40'),
    );
  }

  getPlatformMargin(): number {
    return this.getPlatformMarginPercent() / 100;
  }

  getCreditUsdValue(): number {
    return Number(this.configService.get<string>('AI_CREDIT_USD_VALUE', '0.06'));
  }

  computeAiBudgetUsd(paymentUsd: number): number {
    return computeAiBudgetUsd(paymentUsd, this.getPlatformMarginPercent());
  }

  computeCreditsFromPayment(paymentUsd: number): number {
    return computeCreditsFromPayment(
      paymentUsd,
      this.getCreditUsdValue(),
      this.getPlatformMarginPercent(),
    );
  }

  computeCreditValueUsd(credits: number): number {
    return Number((credits * this.getCreditUsdValue()).toFixed(6));
  }
}
