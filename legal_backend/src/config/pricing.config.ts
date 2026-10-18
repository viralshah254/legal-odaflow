import { Prisma } from '@prisma/client';
import { getCountryConfig } from './countries';
import {
  computeCreditsFromLocalPrice,
  computePlanCreditsForTier,
  DEFAULT_SUBSCRIPTION_MARGIN_PERCENT,
} from '../ai-credits/credit-pricing.util';

/** AI budget as % of plan price allocated to model costs per market tier. */
const DEVELOPING_TIER_PCT = 60; // developing nations: 60% of plan price
const DEVELOPED_TIER_PCT = 50;  // developed nations:  50% of plan price

/** Shorthand helpers used in the seed data below. */
const devCredits = (planAmountUsd: number) =>
  computePlanCreditsForTier(planAmountUsd, DEVELOPING_TIER_PCT);
const prodCredits = (planAmountUsd: number) =>
  computePlanCreditsForTier(planAmountUsd, DEVELOPED_TIER_PCT);

export interface CountryPricingSeed {
  countryCode: string;
  userType: string;
  planId: string;
  currency: string;
  amount: Prisma.Decimal;
  aiCredits: number;
  features: Record<string, boolean | number | string>;
}

export const PRICING_PLANS = {
  CONSUMER_FREE: 'consumer_free',
  CONSUMER_PLUS: 'consumer_plus',
  LAWYER_SOLO: 'lawyer_solo',
  FIRM_SOLO_ENTRY: 'firm_solo_entry',
  FIRM_STARTER: 'firm_starter',
  FIRM_PROFESSIONAL: 'firm_professional',
  FIRM_PRO_PLUS: 'firm_pro_plus',
  FIRM_ENTERPRISE: 'firm_enterprise',
} as const;

/** Retired from public pricing UI and new checkouts; existing subscribers may remain. */
export const RETIRED_PRICING_PLAN_IDS = new Set<string>([
  PRICING_PLANS.LAWYER_SOLO,
]);

export function isRetiredPricingPlan(planId: string): boolean {
  return RETIRED_PRICING_PLAN_IDS.has(planId);
}

export function filterPublicPricingPlans<T extends { planId: string }>(
  plans: T[],
): T[] {
  return plans.filter((plan) => !isRetiredPricingPlan(plan.planId));
}

/** Credits granted once when a consumer account is created. */
export function resolveConsumerSignupCredits(raw?: string | null): number {
  const value = raw ?? process.env.CONSUMER_SIGNUP_CREDITS ?? '100';
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 100;
}

/** Credits granted once when a lawyer tenant is created (free trial / no subscription). */
export function resolveLawyerSignupCredits(
  lawyerRaw?: string | null,
  consumerFallback?: string | null,
): number {
  const value =
    lawyerRaw ??
    process.env.LAWYER_SIGNUP_CREDITS ??
    consumerFallback ??
    process.env.CONSUMER_SIGNUP_CREDITS ??
    '100';
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 100;
}

/** Credits added daily to free-tier consumers (midnight UTC). Paid users never receive this grant. */
export function resolveDailyFreeConsumerCredits(raw?: string | null): number {
  const value = raw ?? process.env.DAILY_FREE_CONSUMER_CREDITS ?? '50';
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 50;
}

/**
 * Countries classified as "developed" markets for pricing purposes.
 * All other countries fall into the "developing" tier.
 */
export const DEVELOPED_MARKET_COUNTRIES = new Set([
  'US', 'GB', 'CA', 'AU', 'NZ', 'DE', 'FR', 'NL', 'SE', 'NO', 'DK', 'CH',
  'JP', 'SG', 'HK', 'AE', 'IE', 'AT', 'BE', 'FI', 'LU',
]);

export function isDevelopedMarket(countryCode: string): boolean {
  return DEVELOPED_MARKET_COUNTRIES.has(countryCode.toUpperCase());
}

/** Used for FX localization of developing markets (KE, …) — not India native INR. */
export const CANONICAL_DEVELOPING_COUNTRY = 'IN';

/** India uses fixed INR list prices — not FX from USD bases. */
export const NATIVE_INR_PRICING_COUNTRY = 'IN';

const inrCredits = (inrAmount: number) =>
  computeCreditsFromLocalPrice(inrAmount, 'INR', DEFAULT_SUBSCRIPTION_MARGIN_PERCENT);

function decimal(value: number): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

/** USD developing-tier bases ($25/$100/$500) — localized via FX for non-India markets. */
export const DEVELOPING_USD_BASE_PLANS: CountryPricingSeed[] = [
  {
    countryCode: '_USD_BASE',
    userType: 'CONSUMER',
    planId: PRICING_PLANS.CONSUMER_FREE,
    currency: 'USD',
    amount: decimal(0),
    aiCredits: 100,
    features: { issueChecker: true, documentUpload: true, lawyerReview: false },
  },
  {
    countryCode: '_USD_BASE',
    userType: 'CONSUMER',
    planId: PRICING_PLANS.CONSUMER_PLUS,
    currency: 'USD',
    amount: decimal(15),
    aiCredits: devCredits(15),
    features: { issueChecker: true, documentUpload: true, lawyerReview: true },
  },
  {
    countryCode: '_USD_BASE',
    userType: 'LAW_FIRM',
    planId: PRICING_PLANS.LAWYER_SOLO,
    currency: 'USD',
    amount: decimal(25),
    aiCredits: devCredits(25),
    features: { seats: 1, copilot: true, portal: false, soloBundle: true, perSeat: true },
  },
  {
    countryCode: '_USD_BASE',
    userType: 'LAW_FIRM',
    planId: PRICING_PLANS.FIRM_STARTER,
    currency: 'USD',
    amount: decimal(25),
    aiCredits: devCredits(25),
    features: { seats: 3, copilot: false, portal: true, perSeat: true },
  },
  {
    countryCode: '_USD_BASE',
    userType: 'LAW_FIRM',
    planId: PRICING_PLANS.FIRM_PROFESSIONAL,
    currency: 'USD',
    amount: decimal(100),
    aiCredits: devCredits(100),
    features: { seats: 10, copilot: true, portal: true, trust: true, perSeat: true },
  },
  {
    countryCode: '_USD_BASE',
    userType: 'LAW_FIRM',
    planId: PRICING_PLANS.FIRM_PRO_PLUS,
    currency: 'USD',
    amount: decimal(500),
    aiCredits: devCredits(500),
    features: { seats: 10, copilot: true, portal: true, trust: true, perSeat: true, proPlus: true },
  },
];

export const COUNTRY_PRICING_SEEDS: CountryPricingSeed[] = [
  // ─────────────────────────────────────────────────────────────
  // INDIA  (native INR list prices — 40% gross margin on AI credits)
  // ─────────────────────────────────────────────────────────────
  {
    countryCode: 'IN',
    userType: 'CONSUMER',
    planId: PRICING_PLANS.CONSUMER_FREE,
    currency: 'INR',
    amount: decimal(0),
    aiCredits: 100,
    features: { issueChecker: true, documentUpload: true, lawyerReview: false },
  },
  {
    countryCode: 'IN',
    userType: 'CONSUMER',
    planId: PRICING_PLANS.CONSUMER_PLUS,
    currency: 'INR',
    amount: decimal(1000),
    aiCredits: inrCredits(1000),
    features: { issueChecker: true, documentUpload: true, lawyerReview: true },
  },
  {
    countryCode: 'IN',
    userType: 'LAW_FIRM',
    planId: PRICING_PLANS.FIRM_SOLO_ENTRY,
    currency: 'INR',
    amount: decimal(500),
    aiCredits: inrCredits(500),  // → 352 credits/month at 40% grant margin
    features: { seats: 1, copilot: true, portal: false, soloBundle: true, perSeat: true },
  },
  {
    countryCode: 'IN',
    userType: 'LAW_FIRM',
    planId: PRICING_PLANS.LAWYER_SOLO,
    currency: 'INR',
    amount: decimal(1400),
    aiCredits: inrCredits(1400),
    features: { seats: 1, copilot: true, portal: false, soloBundle: true, perSeat: true },
  },
  {
    countryCode: 'IN',
    userType: 'LAW_FIRM',
    planId: PRICING_PLANS.FIRM_STARTER,
    currency: 'INR',
    amount: decimal(1400),
    aiCredits: inrCredits(1400),
    features: { seats: 3, copilot: false, portal: true, perSeat: true },
  },
  {
    countryCode: 'IN',
    userType: 'LAW_FIRM',
    planId: PRICING_PLANS.FIRM_PROFESSIONAL,
    currency: 'INR',
    amount: decimal(6000),
    aiCredits: inrCredits(6000),
    features: { seats: 10, copilot: true, portal: true, trust: true, perSeat: true },
  },
  {
    countryCode: 'IN',
    userType: 'LAW_FIRM',
    planId: PRICING_PLANS.FIRM_PRO_PLUS,
    currency: 'INR',
    amount: decimal(30000),
    aiCredits: inrCredits(30000),
    features: { seats: 10, copilot: true, portal: true, trust: true, perSeat: true, proPlus: true },
  },
  // ─────────────────────────────────────────────────────────────
  // UNITED STATES  (developed market — $50/$50/$200/$1000 USD)
  // ─────────────────────────────────────────────────────────────
  {
    countryCode: 'US',
    userType: 'CONSUMER',
    planId: PRICING_PLANS.CONSUMER_FREE,
    currency: 'USD',
    amount: decimal(0),
    aiCredits: 100,
    features: { issueChecker: true, documentUpload: true, lawyerReview: false },
  },
  {
    countryCode: 'US',
    userType: 'CONSUMER',
    planId: PRICING_PLANS.CONSUMER_PLUS,
    currency: 'USD',
    amount: decimal(15),
    aiCredits: prodCredits(15),     // $7.50 AI budget → 750 credits
    features: { issueChecker: true, documentUpload: true, lawyerReview: true },
  },
  {
    countryCode: 'US',
    userType: 'LAW_FIRM',
    planId: PRICING_PLANS.LAWYER_SOLO,
    currency: 'USD',
    amount: decimal(50),
    aiCredits: prodCredits(50),     // $25 AI budget → 2500 credits
    features: { seats: 1, copilot: true, portal: false, soloBundle: true, perSeat: true },
  },
  {
    countryCode: 'US',
    userType: 'LAW_FIRM',
    planId: PRICING_PLANS.FIRM_STARTER,
    currency: 'USD',
    amount: decimal(50),
    aiCredits: prodCredits(50),     // $25 AI budget → 2500 credits
    features: { seats: 3, copilot: false, portal: true, perSeat: true },
  },
  {
    countryCode: 'US',
    userType: 'LAW_FIRM',
    planId: PRICING_PLANS.FIRM_PROFESSIONAL,
    currency: 'USD',
    amount: decimal(200),
    aiCredits: prodCredits(200),    // $100 AI budget → 10000 credits
    features: { seats: 10, copilot: true, portal: true, trust: true, perSeat: true },
  },
  {
    countryCode: 'US',
    userType: 'LAW_FIRM',
    planId: PRICING_PLANS.FIRM_PRO_PLUS,
    currency: 'USD',
    amount: decimal(1000),
    aiCredits: prodCredits(1000),   // $500 AI budget → 50000 credits
    features: { seats: 10, copilot: true, portal: true, trust: true, perSeat: true, proPlus: true },
  },
  {
    countryCode: 'US',
    userType: 'LAW_FIRM',
    planId: PRICING_PLANS.FIRM_ENTERPRISE,
    currency: 'USD',
    amount: decimal(0),
    aiCredits: 50000,               // enterprise: custom negotiated
    features: {
      seats: 999,
      copilot: true,
      portal: true,
      trust: true,
      enterprise: true,
      contactSales: true,
      perSeat: true,
    },
  },
  // ─────────────────────────────────────────────────────────────
  // KENYA  (developing market — $25/$25/$100/$500 USD)
  // ─────────────────────────────────────────────────────────────
  {
    countryCode: 'KE',
    userType: 'CONSUMER',
    planId: PRICING_PLANS.CONSUMER_FREE,
    currency: 'USD',
    amount: decimal(0),
    aiCredits: 100,
    features: { issueChecker: true, documentUpload: true, lawyerReview: false },
  },
  {
    countryCode: 'KE',
    userType: 'CONSUMER',
    planId: PRICING_PLANS.CONSUMER_PLUS,
    currency: 'USD',
    amount: decimal(9),
    aiCredits: devCredits(9),       // $5.40 AI budget → 540 credits
    features: { issueChecker: true, documentUpload: true, lawyerReview: true },
  },
  {
    countryCode: 'KE',
    userType: 'LAW_FIRM',
    planId: PRICING_PLANS.LAWYER_SOLO,
    currency: 'USD',
    amount: decimal(25),
    aiCredits: devCredits(25),      // $15 AI budget → 1500 credits
    features: { seats: 1, copilot: true, portal: false, soloBundle: true, perSeat: true },
  },
  {
    countryCode: 'KE',
    userType: 'LAW_FIRM',
    planId: PRICING_PLANS.FIRM_STARTER,
    currency: 'USD',
    amount: decimal(25),
    aiCredits: devCredits(25),      // $15 AI budget → 1500 credits
    features: { seats: 3, copilot: false, portal: true, perSeat: true },
  },
  {
    countryCode: 'KE',
    userType: 'LAW_FIRM',
    planId: PRICING_PLANS.FIRM_PROFESSIONAL,
    currency: 'USD',
    amount: decimal(100),
    aiCredits: devCredits(100),     // $60 AI budget → 6000 credits
    features: { seats: 10, copilot: true, portal: true, trust: true, perSeat: true },
  },
  {
    countryCode: 'KE',
    userType: 'LAW_FIRM',
    planId: PRICING_PLANS.FIRM_PRO_PLUS,
    currency: 'USD',
    amount: decimal(500),
    aiCredits: devCredits(500),     // $300 AI budget → 30000 credits
    features: { seats: 10, copilot: true, portal: true, trust: true, perSeat: true, proPlus: true },
  },
  // ─────────────────────────────────────────────────────────────
  // UNITED KINGDOM  (developed market — $50/$50/$200/$1000 in GBP equiv)
  // ─────────────────────────────────────────────────────────────
  {
    countryCode: 'GB',
    userType: 'CONSUMER',
    planId: PRICING_PLANS.CONSUMER_FREE,
    currency: 'GBP',
    amount: decimal(0),
    aiCredits: 100,
    features: { issueChecker: true, documentUpload: true, lawyerReview: false },
  },
  {
    countryCode: 'GB',
    userType: 'CONSUMER',
    planId: PRICING_PLANS.CONSUMER_PLUS,
    currency: 'GBP',
    amount: decimal(7.99),
    aiCredits: prodCredits(10),     // ~$10 equivalent → $5 AI budget → 500 credits
    features: { issueChecker: true, documentUpload: true, lawyerReview: true },
  },
  {
    countryCode: 'GB',
    userType: 'LAW_FIRM',
    planId: PRICING_PLANS.LAWYER_SOLO,
    currency: 'USD',
    amount: decimal(50),
    aiCredits: prodCredits(50),     // $25 AI budget → 2500 credits
    features: { seats: 1, copilot: true, portal: false, soloBundle: true, perSeat: true },
  },
  {
    countryCode: 'GB',
    userType: 'LAW_FIRM',
    planId: PRICING_PLANS.FIRM_STARTER,
    currency: 'USD',
    amount: decimal(50),
    aiCredits: prodCredits(50),     // $25 AI budget → 2500 credits
    features: { seats: 3, copilot: false, portal: true, perSeat: true },
  },
  {
    countryCode: 'GB',
    userType: 'LAW_FIRM',
    planId: PRICING_PLANS.FIRM_PROFESSIONAL,
    currency: 'USD',
    amount: decimal(200),
    aiCredits: prodCredits(200),    // $100 AI budget → 10000 credits
    features: { seats: 10, copilot: true, portal: true, trust: true, perSeat: true },
  },
  {
    countryCode: 'GB',
    userType: 'LAW_FIRM',
    planId: PRICING_PLANS.FIRM_PRO_PLUS,
    currency: 'USD',
    amount: decimal(1000),
    aiCredits: prodCredits(1000),   // $500 AI budget → 50000 credits
    features: { seats: 10, copilot: true, portal: true, trust: true, perSeat: true, proPlus: true },
  },
];

export function getPricingForCountry(
  countryCode: string,
  userType: string,
  planId: string,
): CountryPricingSeed | undefined {
  return COUNTRY_PRICING_SEEDS.find(
    (seed) =>
      seed.countryCode === countryCode.toUpperCase() &&
      seed.userType === userType &&
      seed.planId === planId,
  );
}

export function findDevelopingUsdBasePlan(
  userType: string,
  planId: string,
): CountryPricingSeed | undefined {
  return DEVELOPING_USD_BASE_PLANS.find(
    (seed) => seed.userType === userType && seed.planId === planId,
  );
}

export function isNativeInrPricingCountry(countryCode: string): boolean {
  return countryCode.toUpperCase() === NATIVE_INR_PRICING_COUNTRY;
}

export function getDefaultConsumerFreePlan(
  countryCode: string,
  signupCredits = resolveConsumerSignupCredits(),
): CountryPricingSeed {
  const seed = getPricingForCountry(countryCode, 'CONSUMER', PRICING_PLANS.CONSUMER_FREE);
  if (seed) {
    return { ...seed, aiCredits: signupCredits };
  }

  const country = getCountryConfig(countryCode);
  return {
    countryCode: country.code,
    userType: 'CONSUMER',
    planId: PRICING_PLANS.CONSUMER_FREE,
    currency: country.currency,
    amount: decimal(0),
    aiCredits: signupCredits,
    features: { issueChecker: true, documentUpload: true, lawyerReview: false },
  };
}
