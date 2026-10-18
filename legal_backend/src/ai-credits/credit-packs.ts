import { getCountryConfig } from '@/config/countries';
import { getPlanNetMarginPercent } from '@/config/billing-plans';
import { CurrencyFxService } from '@/config/currency-fx.service';
import {
  computeCreditsFromLocalPrice,
  computeCreditsFromPayment,
  DEFAULT_CREDIT_USD_VALUE,
  DEFAULT_SUBSCRIPTION_MARGIN_PERCENT,
} from './credit-pricing.util';

export interface CreditPack {
  packId: string;
  credits: number;
  label: string;
  description: string;
}

const BASE_PACKS: Omit<CreditPack, 'credits'>[] = [
  {
    packId: 'pack_10',
    label: 'Starter top-up',
    description: 'Good for light AI usage',
  },
  {
    packId: 'pack_25',
    label: 'Popular top-up',
    description: 'Most popular top-up',
  },
  {
    packId: 'pack_50',
    label: 'Power top-up',
    description: 'Best value for frequent use',
  },
];

const PACK_PRICES_USD: Record<string, number> = {
  pack_10: 4.99,
  pack_25: 9.99,
  pack_50: 17.99,
};

/** Round INR top-up prices for India — 40% gross margin on credits. */
const INDIA_TOPUP_PACK_PRICES_INR: Record<string, number> = {
  pack_10: 499,
  pack_25: 999,
  pack_50: 1799,
};

const CURRENCY_MULTIPLIERS: Record<string, number> = {
  USD: 1,
  GBP: 0.79,
  EUR: 0.92,
  INR: 83,
  KES: 129,
  AUD: 1.55,
  CAD: 1.37,
  SGD: 1.35,
  AED: 3.67,
  NZD: 1.70,
};

const MIN_MARGIN_PERCENT = 40;

function resolveMarginPercent(billingPlan?: string | null): number {
  const raw = billingPlan
    ? getPlanNetMarginPercent(billingPlan)
    : Number(process.env.AI_PLATFORM_MARGIN_PERCENT ?? DEFAULT_SUBSCRIPTION_MARGIN_PERCENT);
  return Math.max(MIN_MARGIN_PERCENT, raw);
}

function resolveCreditUsdValue(): number {
  const raw = process.env.AI_CREDIT_USD_VALUE;
  return raw ? Number(raw) : DEFAULT_CREDIT_USD_VALUE;
}

export function listCreditPacks(countryCode: string, billingPlan?: string | null) {
  const country = getCountryConfig(countryCode);
  const marginPercent = resolveMarginPercent(billingPlan);
  const creditUsdValue = resolveCreditUsdValue();

  if (country.code === 'IN') {
    return BASE_PACKS.map((pack) => {
      const amount = INDIA_TOPUP_PACK_PRICES_INR[pack.packId];
      const credits = computeCreditsFromLocalPrice(amount, 'INR', marginPercent, creditUsdValue);
      return {
        ...pack,
        credits,
        countryCode: country.code,
        currency: 'INR',
        amount,
        usdPrice: PACK_PRICES_USD[pack.packId],
      };
    });
  }

  const multiplier = CURRENCY_MULTIPLIERS[country.currency] ?? 1;

  return BASE_PACKS.map((pack) => {
    const usd = PACK_PRICES_USD[pack.packId];
    const amount = Number((usd * multiplier).toFixed(2));
    const credits = computeCreditsFromPayment(usd, creditUsdValue, marginPercent);
    return {
      ...pack,
      credits,
      countryCode: country.code,
      currency: country.currency,
      amount,
      usdPrice: usd,
    };
  });
}

export function getCreditPack(
  countryCode: string,
  packId: string,
  billingPlan?: string | null,
) {
  const pack = listCreditPacks(countryCode, billingPlan).find((row) => row.packId === packId);
  if (!pack) {
    throw new Error(`Unknown credit pack: ${packId}`);
  }
  return pack;
}

export async function listLocalizedCreditPacks(
  countryCode: string,
  currencyFx: CurrencyFxService,
  billingPlan?: string | null,
) {
  const country = getCountryConfig(countryCode);
  const marginPercent = resolveMarginPercent(billingPlan);
  const creditUsdValue = resolveCreditUsdValue();

  if (country.code === 'IN') {
    return listCreditPacks(countryCode, billingPlan);
  }

  return Promise.all(
    BASE_PACKS.map(async (pack) => {
      const usd = PACK_PRICES_USD[pack.packId];
      const amount = await currencyFx.convertUsdAmount(usd, country.currency);
      const credits = computeCreditsFromPayment(usd, creditUsdValue, marginPercent);
      return {
        ...pack,
        credits,
        countryCode: country.code,
        currency: country.currency,
        amount,
        usdPrice: usd,
      };
    }),
  );
}

export async function getLocalizedCreditPack(
  countryCode: string,
  packId: string,
  currencyFx: CurrencyFxService,
  billingPlan?: string | null,
) {
  const pack = (await listLocalizedCreditPacks(countryCode, currencyFx, billingPlan)).find(
    (row) => row.packId === packId,
  );
  if (!pack) {
    throw new Error(`Unknown credit pack: ${packId}`);
  }
  return pack;
}
