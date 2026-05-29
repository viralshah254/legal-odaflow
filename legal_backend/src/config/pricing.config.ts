import { Prisma } from '@prisma/client';
import { getCountryConfig } from './countries';

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
  FIRM_STARTER: 'firm_starter',
  FIRM_PROFESSIONAL: 'firm_professional',
  FIRM_ENTERPRISE: 'firm_enterprise',
} as const;

function decimal(value: number): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

export const COUNTRY_PRICING_SEEDS: CountryPricingSeed[] = [
  {
    countryCode: 'IN',
    userType: 'CONSUMER',
    planId: PRICING_PLANS.CONSUMER_FREE,
    currency: 'INR',
    amount: decimal(0),
    aiCredits: 3,
    features: { issueChecker: true, documentUpload: true, lawyerReview: false },
  },
  {
    countryCode: 'IN',
    userType: 'CONSUMER',
    planId: PRICING_PLANS.CONSUMER_PLUS,
    currency: 'INR',
    amount: decimal(499),
    aiCredits: 25,
    features: { issueChecker: true, documentUpload: true, lawyerReview: true },
  },
  {
    countryCode: 'IN',
    userType: 'LAW_FIRM',
    planId: PRICING_PLANS.LAWYER_SOLO,
    currency: 'INR',
    amount: decimal(499),
    aiCredits: 75,
    features: { seats: 1, copilot: true, portal: false, soloBundle: true },
  },
  {
    countryCode: 'IN',
    userType: 'LAW_FIRM',
    planId: PRICING_PLANS.FIRM_STARTER,
    currency: 'INR',
    amount: decimal(999),
    aiCredits: 50,
    features: { seats: 3, copilot: false, portal: true },
  },
  {
    countryCode: 'IN',
    userType: 'LAW_FIRM',
    planId: PRICING_PLANS.FIRM_PROFESSIONAL,
    currency: 'INR',
    amount: decimal(1499),
    aiCredits: 200,
    features: { seats: 10, copilot: true, portal: true, trust: true },
  },
  {
    countryCode: 'US',
    userType: 'CONSUMER',
    planId: PRICING_PLANS.CONSUMER_FREE,
    currency: 'USD',
    amount: decimal(0),
    aiCredits: 3,
    features: { issueChecker: true, documentUpload: true, lawyerReview: false },
  },
  {
    countryCode: 'US',
    userType: 'CONSUMER',
    planId: PRICING_PLANS.CONSUMER_PLUS,
    currency: 'USD',
    amount: decimal(9.99),
    aiCredits: 25,
    features: { issueChecker: true, documentUpload: true, lawyerReview: true },
  },
  {
    countryCode: 'US',
    userType: 'LAW_FIRM',
    planId: PRICING_PLANS.LAWYER_SOLO,
    currency: 'USD',
    amount: decimal(12),
    aiCredits: 75,
    features: { seats: 1, copilot: true, portal: false, soloBundle: true },
  },
  {
    countryCode: 'US',
    userType: 'LAW_FIRM',
    planId: PRICING_PLANS.FIRM_STARTER,
    currency: 'USD',
    amount: decimal(20),
    aiCredits: 100,
    features: { seats: 3, copilot: false, portal: true },
  },
  {
    countryCode: 'US',
    userType: 'LAW_FIRM',
    planId: PRICING_PLANS.FIRM_PROFESSIONAL,
    currency: 'USD',
    amount: decimal(25),
    aiCredits: 500,
    features: { seats: 10, copilot: true, portal: true, trust: true },
  },
  {
    countryCode: 'KE',
    userType: 'CONSUMER',
    planId: PRICING_PLANS.CONSUMER_FREE,
    currency: 'KES',
    amount: decimal(0),
    aiCredits: 3,
    features: { issueChecker: true, documentUpload: true, lawyerReview: false },
  },
  {
    countryCode: 'KE',
    userType: 'CONSUMER',
    planId: PRICING_PLANS.CONSUMER_PLUS,
    currency: 'KES',
    amount: decimal(999),
    aiCredits: 25,
    features: { issueChecker: true, documentUpload: true, lawyerReview: true },
  },
  {
    countryCode: 'KE',
    userType: 'LAW_FIRM',
    planId: PRICING_PLANS.FIRM_STARTER,
    currency: 'KES',
    amount: decimal(1500),
    aiCredits: 100,
    features: { seats: 3, copilot: false, portal: true },
  },
  {
    countryCode: 'KE',
    userType: 'LAW_FIRM',
    planId: PRICING_PLANS.FIRM_PROFESSIONAL,
    currency: 'KES',
    amount: decimal(2500),
    aiCredits: 500,
    features: { seats: 10, copilot: true, portal: true, trust: true },
  },
  {
    countryCode: 'GB',
    userType: 'CONSUMER',
    planId: PRICING_PLANS.CONSUMER_FREE,
    currency: 'GBP',
    amount: decimal(0),
    aiCredits: 3,
    features: { issueChecker: true, documentUpload: true, lawyerReview: false },
  },
  {
    countryCode: 'GB',
    userType: 'CONSUMER',
    planId: PRICING_PLANS.CONSUMER_PLUS,
    currency: 'GBP',
    amount: decimal(7.99),
    aiCredits: 25,
    features: { issueChecker: true, documentUpload: true, lawyerReview: true },
  },
  {
    countryCode: 'GB',
    userType: 'LAW_FIRM',
    planId: PRICING_PLANS.FIRM_STARTER,
    currency: 'GBP',
    amount: decimal(20),
    aiCredits: 100,
    features: { seats: 3, copilot: false, portal: true },
  },
  {
    countryCode: 'GB',
    userType: 'LAW_FIRM',
    planId: PRICING_PLANS.FIRM_PROFESSIONAL,
    currency: 'GBP',
    amount: decimal(25),
    aiCredits: 500,
    features: { seats: 10, copilot: true, portal: true, trust: true },
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

export function getDefaultConsumerFreePlan(countryCode: string): CountryPricingSeed {
  const seed = getPricingForCountry(countryCode, 'CONSUMER', PRICING_PLANS.CONSUMER_FREE);
  if (seed) {
    return seed;
  }

  const country = getCountryConfig(countryCode);
  return {
    countryCode: country.code,
    userType: 'CONSUMER',
    planId: PRICING_PLANS.CONSUMER_FREE,
    currency: country.currency,
    amount: decimal(0),
    aiCredits: country.consumerFreePreviews,
    features: { issueChecker: true, documentUpload: true, lawyerReview: false },
  };
}
