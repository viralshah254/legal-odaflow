import { getCountryConfig } from '@/config/countries';
import { computeCreditsFromPayment } from './credit-pricing.util';

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

const CURRENCY_MULTIPLIERS: Record<string, number> = {
  USD: 1,
  GBP: 0.79,
  INR: 83,
  KES: 129,
};

function resolveMarginPercent(): number {
  const raw = process.env.AI_PLATFORM_MARGIN_PERCENT;
  return raw ? Number(raw) : 40;
}

function resolveCreditUsdValue(): number {
  const raw = process.env.AI_CREDIT_USD_VALUE;
  return raw ? Number(raw) : 0.06;
}

export function listCreditPacks(countryCode: string) {
  const country = getCountryConfig(countryCode);
  const multiplier = CURRENCY_MULTIPLIERS[country.currency] ?? 1;
  const marginPercent = resolveMarginPercent();
  const creditUsdValue = resolveCreditUsdValue();

  return BASE_PACKS.map((pack) => {
    const amount = Number((PACK_PRICES_USD[pack.packId] * multiplier).toFixed(2));
    const credits = computeCreditsFromPayment(amount, creditUsdValue, marginPercent);
    return {
      ...pack,
      credits,
      countryCode: country.code,
      currency: country.currency,
      amount,
    };
  });
}

export function getCreditPack(countryCode: string, packId: string) {
  const pack = listCreditPacks(countryCode).find((row) => row.packId === packId);
  if (!pack) {
    throw new Error(`Unknown credit pack: ${packId}`);
  }
  return pack;
}
