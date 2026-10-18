import { ConfigService } from '@nestjs/config';
import { getCountryConfig } from './countries';
import { PRICING_PLANS, isDevelopedMarket } from './pricing.config';

/**
 * Two sets of Stripe Price IDs — one per market tier.
 *
 *  Developing  (IN, KE, and all non-listed): $25 / $25 / $100 / $500
 *  Developed   (US, GB, CA, AU, DE, …):     $50 / $50 / $200 / $1 000
 *
 * Run `npx ts-node scripts/setup-stripe-billing.ts` to create prices in
 * Stripe and populate these env vars automatically.
 */
export const STRIPE_PRICE_ENV_BY_PLAN_DEVELOPING: Record<string, string> = {
  [PRICING_PLANS.LAWYER_SOLO]:        'STRIPE_PRICE_LAWYER_SOLO_DEVELOPING',
  [PRICING_PLANS.FIRM_STARTER]:       'STRIPE_PRICE_FIRM_STARTER_DEVELOPING',
  [PRICING_PLANS.FIRM_PROFESSIONAL]:  'STRIPE_PRICE_FIRM_PROFESSIONAL_DEVELOPING',
  [PRICING_PLANS.FIRM_PRO_PLUS]:      'STRIPE_PRICE_FIRM_PRO_PLUS_DEVELOPING',
};

export const STRIPE_PRICE_ENV_BY_PLAN_DEVELOPED: Record<string, string> = {
  [PRICING_PLANS.LAWYER_SOLO]:        'STRIPE_PRICE_LAWYER_SOLO_DEVELOPED',
  [PRICING_PLANS.FIRM_STARTER]:       'STRIPE_PRICE_FIRM_STARTER_DEVELOPED',
  [PRICING_PLANS.FIRM_PROFESSIONAL]:  'STRIPE_PRICE_FIRM_PROFESSIONAL_DEVELOPED',
  [PRICING_PLANS.FIRM_PRO_PLUS]:      'STRIPE_PRICE_FIRM_PRO_PLUS_DEVELOPED',
};

/** Native INR Stripe prices for India checkout. */
export const STRIPE_PRICE_ENV_BY_PLAN_INR: Record<string, string> = {
  [PRICING_PLANS.FIRM_SOLO_ENTRY]:    'STRIPE_PRICE_FIRM_SOLO_ENTRY_INR',
  [PRICING_PLANS.LAWYER_SOLO]:        'STRIPE_PRICE_LAWYER_SOLO_INR',
  [PRICING_PLANS.FIRM_STARTER]:       'STRIPE_PRICE_FIRM_STARTER_INR',
  [PRICING_PLANS.FIRM_PROFESSIONAL]:  'STRIPE_PRICE_FIRM_PROFESSIONAL_INR',
  [PRICING_PLANS.FIRM_PRO_PLUS]:      'STRIPE_PRICE_FIRM_PRO_PLUS_INR',
  [PRICING_PLANS.CONSUMER_PLUS]:      'STRIPE_PRICE_CONSUMER_PLUS_INR',
};

/** Legacy single-tier env vars — kept for backward compatibility. */
export const STRIPE_PRICE_ENV_BY_PLAN_LEGACY: Record<string, string> = {
  [PRICING_PLANS.LAWYER_SOLO]:        'STRIPE_PRICE_LAWYER_SOLO',
  [PRICING_PLANS.FIRM_STARTER]:       'STRIPE_PRICE_FIRM_STARTER',
  [PRICING_PLANS.FIRM_PROFESSIONAL]:  'STRIPE_PRICE_FIRM_PROFESSIONAL',
  [PRICING_PLANS.FIRM_PRO_PLUS]:      'STRIPE_PRICE_FIRM_PRO_PLUS',
};

/** All unique env var keys (for isStripeBillingConfigured). */
export const ALL_STRIPE_PRICE_ENV_KEYS = [
  ...Object.values(STRIPE_PRICE_ENV_BY_PLAN_DEVELOPING),
  ...Object.values(STRIPE_PRICE_ENV_BY_PLAN_DEVELOPED),
  ...Object.values(STRIPE_PRICE_ENV_BY_PLAN_INR),
  ...Object.values(STRIPE_PRICE_ENV_BY_PLAN_LEGACY),
];

/**
 * Returns the Stripe Price ID for a given plan + country.
 * India uses native INR prices; other markets use developing/developed USD tiers.
 */
export function getStripePriceId(
  planId: string,
  configService: ConfigService,
  countryCode = 'US',
): string | null {
  const normalized = countryCode.toUpperCase();

  if (normalized === 'IN') {
    const inrKey = STRIPE_PRICE_ENV_BY_PLAN_INR[planId];
    if (inrKey) {
      const inrValue = configService.get<string>(inrKey, '')?.trim();
      if (inrValue) return inrValue;
    }
  }

  const envMap = isDevelopedMarket(normalized)
    ? STRIPE_PRICE_ENV_BY_PLAN_DEVELOPED
    : STRIPE_PRICE_ENV_BY_PLAN_DEVELOPING;

  const tieredKey = envMap[planId];
  if (tieredKey) {
    const tieredValue = configService.get<string>(tieredKey, '')?.trim();
    if (tieredValue) return tieredValue;
  }

  // Fall back to legacy single-tier env var
  const legacyKey = STRIPE_PRICE_ENV_BY_PLAN_LEGACY[planId];
  if (legacyKey) {
    const legacyValue = configService.get<string>(legacyKey, '')?.trim();
    if (legacyValue) return legacyValue;
  }

  return null;
}

export function isStripeBillingConfigured(configService: ConfigService): boolean {
  const secret = configService.get<string>('STRIPE_SECRET_KEY', '')?.trim();
  if (!secret) return false;
  return ALL_STRIPE_PRICE_ENV_KEYS.some((key) =>
    Boolean(configService.get<string>(key, '')?.trim()),
  );
}

/** Use Stripe Checkout when secret key is set. */
export function shouldUseStripeSubscriptionCheckout(
  configService: ConfigService,
  planId: string,
  countryCode = 'US',
): boolean {
  const hasSecret = Boolean(configService.get<string>('STRIPE_SECRET_KEY', '')?.trim());
  if (!hasSecret) return false;

  try {
    getCountryConfig(countryCode);
  } catch {
    // Unknown country code — still allow Stripe when secret is configured.
  }

  return Boolean(getStripePriceId(planId, configService, countryCode)) || hasSecret;
}
