import { Injectable, Logger } from '@nestjs/common';
import {
  convertUsdToLocalAmount,
  FALLBACK_USD_TO_LOCAL,
  FX_MARKUP_PERCENT,
} from './currency-fx.util';

type FrankfurterResponse = {
  rates?: Record<string, number>;
};

@Injectable()
export class CurrencyFxService {
  private readonly logger = new Logger(CurrencyFxService.name);
  private cache: {
    rates: Record<string, number>;
    fetchedAt: number;
    source: 'frankfurter' | 'fallback';
  } | null = null;
  private readonly ttlMs = 60 * 60 * 1000;

  get markupPercent(): number {
    return FX_MARKUP_PERCENT;
  }

  async convertUsdAmount(usdAmount: number, currency: string, countryCode?: string): Promise<number> {
    const c = currency.toUpperCase();
    if (usdAmount <= 0) return 0;
    if (c === 'USD') {
      const { getCountryPricingTier } = await import('./currency-fx.util');
      const tier = countryCode ? getCountryPricingTier(countryCode) : 1.0;
      return usdAmount * tier;
    }
    const rate = await this.getUsdToLocalRate(c);
    return convertUsdToLocalAmount(usdAmount, c, rate, countryCode);
  }

  async getUsdToLocalRate(currency: string): Promise<number> {
    const meta = await this.getRateMetadata(currency);
    return meta.rate;
  }

  async getRateMetadata(currency: string): Promise<{
    currency: string;
    rate: number;
    source: 'frankfurter' | 'fallback';
    markupPercent: number;
  }> {
    const c = currency.toUpperCase();
    if (c === 'USD') {
      return { currency: c, rate: 1, source: 'fallback', markupPercent: FX_MARKUP_PERCENT };
    }
    const { rates, source } = await this.loadUsdRates();
    const rate = rates[c] ?? FALLBACK_USD_TO_LOCAL[c] ?? 1;
    return { currency: c, rate, source, markupPercent: FX_MARKUP_PERCENT };
  }

  private async loadUsdRates(): Promise<{
    rates: Record<string, number>;
    source: 'frankfurter' | 'fallback';
  }> {
    const now = Date.now();
    if (this.cache && now - this.cache.fetchedAt < this.ttlMs) {
      return { rates: this.cache.rates, source: this.cache.source };
    }

    try {
      const response = await fetch('https://api.frankfurter.app/latest?from=USD', {
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) {
        throw new Error(`Frankfurter HTTP ${response.status}`);
      }
      const payload = (await response.json()) as FrankfurterResponse;
      const rates = payload.rates ?? {};
      this.cache = { rates, fetchedAt: now, source: 'frankfurter' };
      return { rates, source: 'frankfurter' };
    } catch (error) {
      this.logger.warn(
        `FX rate fetch failed, using fallback rates: ${error instanceof Error ? error.message : error}`,
      );
      return { rates: { ...FALLBACK_USD_TO_LOCAL }, source: 'fallback' };
    }
  }
}
