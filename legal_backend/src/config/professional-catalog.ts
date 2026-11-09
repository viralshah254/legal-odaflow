/** Immutable target catalog. Existing subscriptions and legacy checkout IDs are
 * deliberately separate; enabling purchases requires a verified product mapping. */
export const PROFESSIONAL_CATALOG_VERSION = '2026-11-v1';
export const CREDIT_USD_VALUE = 0.01;
export type ProfessionalPlan = 'solo' | 'solo_pro' | 'team' | 'growth';
export type PurchaseChannel = 'web' | 'apple' | 'google';

const PACKAGES = [
  { id: 'solo', name: 'Solo', seats: 1, coordinatorSeats: 0, storageGb: 10, concurrentJobs: 2 },
  { id: 'solo_pro', name: 'Solo Pro', seats: 1, coordinatorSeats: 0, storageGb: 25, concurrentJobs: 3 },
  { id: 'team', name: 'Firm Team', seats: 5, coordinatorSeats: 2, storageGb: 100, concurrentJobs: 6 },
  { id: 'growth', name: 'Firm Growth', seats: 10, coordinatorSeats: 4, storageGb: 250, concurrentJobs: 12 },
] as const;

const REGIONS = {
  IN: { currency: 'INR', amounts: [1499, 2999, 7499, 14999], annualMonths: 10 },
  KE: { currency: 'KES', amounts: [6500, 12000, 30000, 55000], annualMonths: 10 },
  GLOBAL: { currency: 'USD', amounts: [100, 200, 500, 900], annualMonths: 10.2 },
} as const;
const GLOBAL_CREDITS = [1000, 4000, 10000, 20000];

export function grossUpPrice(amount: number, deductionRate: number): number {
  if (!Number.isFinite(amount) || amount < 0 || !Number.isFinite(deductionRate) || deductionRate < 0 || deductionRate >= 1) {
    throw new Error('Invalid amount or payment deduction');
  }
  return Math.ceil((amount / (1 - deductionRate) - Number.EPSILON) * 100) / 100;
}

export function contributionMargin(params: {
  revenue: number; paymentRate: number; providerCost: number; otherDirectCost: number;
}) {
  const { revenue, paymentRate, providerCost, otherDirectCost } = params;
  if (![revenue, providerCost, otherDirectCost].every((value) => Number.isFinite(value) && value >= 0) ||
      !Number.isFinite(paymentRate) || paymentRate < 0 || paymentRate >= 1) throw new Error('Invalid economics inputs');
  const netRevenue = revenue * (1 - paymentRate);
  const contribution = netRevenue - providerCost - otherDirectCost;
  return { netRevenue, contribution, margin: netRevenue > 0 ? contribution / netRevenue : null };
}

export function professionalCatalog(input: {
  countryCode: string;
  interval?: 'month' | 'year';
  channel?: PurchaseChannel;
  /** Server-controlled, effective store profile; missing means no mobile quote. */
  deductionRate?: number;
  /** Approved fixed catalog FX reference, local currency units per USD. */
  localPerUsd?: number;
  fxVersion?: string;
}) {
  const countryCode = input.countryCode.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(countryCode)) throw new Error('A two-letter billing country is required');
  if (input.interval && !['month', 'year'].includes(input.interval)) throw new Error('Invalid billing interval');
  if (input.channel && !['web', 'apple', 'google'].includes(input.channel)) throw new Error('Invalid purchase channel');
  if (input.deductionRate !== undefined) grossUpPrice(0, input.deductionRate);
  const region = countryCode === 'IN' || countryCode === 'KE' ? countryCode : 'GLOBAL';
  const config = REGIONS[region];
  const interval = input.interval ?? 'month';
  const channel = input.channel ?? 'web';
  const hasFx = region === 'GLOBAL' || (Boolean(input.fxVersion) && Number.isFinite(input.localPerUsd) && input.localPerUsd! > 0);
  return {
    catalogVersion: PROFESSIONAL_CATALOG_VERSION,
    audience: 'LEGAL_PROFESSIONAL', countryCode, region, currency: config.currency,
    interval, channel, taxIncluded: false, creditUsdValue: CREDIT_USD_VALUE,
    fxVersion: region === 'GLOBAL' ? 'USD' : input.fxVersion ?? null,
    plans: PACKAGES.map((plan, index) => {
      const monthlyAmount = config.amounts[index];
      const months = region === 'GLOBAL' && plan.id === 'solo' ? 12 : config.annualMonths;
      const amount = Math.round(monthlyAmount * (interval === 'year' ? months : 1) * 100) / 100;
      const referenceAmount = channel === 'web' ? amount : input.deductionRate === undefined ? null : grossUpPrice(amount, input.deductionRate);
      const credits = region === 'GLOBAL' ? GLOBAL_CREDITS[index] : hasFx
        ? Math.floor((monthlyAmount * 0.2) / input.localPerUsd! / CREDIT_USD_VALUE) : null;
      return {
        ...plan, planId: `professional_${plan.id}`, monthlyAmount, amount,
        referencePurchaseAmount: referenceAmount, monthlyCredits: credits,
        maximumIncludedProviderCostUsd: credits === null ? null : credits * CREDIT_USD_VALUE / 2,
        // Never route a new catalog ID to a legacy per-seat checkout. Native
        // prices must come from StoreKit/Play and verified server mappings.
        checkoutEligible: false,
        readiness: !hasFx ? 'CATALOG_FX_REQUIRED' : channel !== 'web' && input.deductionRate === undefined
          ? 'STORE_FEE_PROFILE_REQUIRED' : 'PRODUCT_MAPPING_REQUIRED',
      };
    }),
  };
}
