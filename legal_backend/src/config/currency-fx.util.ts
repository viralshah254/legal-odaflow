/** Markup applied on top of the fetched USD→local exchange rate. */
export const FX_MARKUP_PERCENT = 1.5;

/**
 * Countries charged at 2× the base USD price (converted to local currency).
 * Developing/emerging markets pay 1× to ensure accessibility.
 */
export const DEVELOPED_COUNTRY_CODES = new Set([
  'US', 'GB', 'CA', 'AU', 'NZ',
  'DE', 'FR', 'NL', 'SE', 'NO', 'DK', 'FI', 'CH', 'BE', 'AT', 'IE',
  'JP', 'KR', 'SG', 'AE', 'IL', 'IT', 'ES',
]);

/** Pricing multiplier for a given country (2x developed, 1x developing). */
export function getCountryPricingTier(countryCode: string): number {
  return DEVELOPED_COUNTRY_CODES.has(countryCode.toUpperCase()) ? 2.0 : 1.0;
}

/** USD per 1 unit of local currency is inverted — these are units of local per 1 USD. */
export const FALLBACK_USD_TO_LOCAL: Record<string, number> = {
  USD: 1,
  INR: 83,
  GBP: 0.79,
  KES: 129,
};

export function applyFxMarkup(usdAmount: number, usdToLocalRate: number, tierMultiplier = 1.0): number {
  return usdAmount * tierMultiplier * usdToLocalRate * (1 + FX_MARKUP_PERCENT / 100);
}

export function roundForCurrency(amount: number, currency: string): number {
  const c = currency.toUpperCase();
  if (c === 'INR' || c === 'KES') {
    return Math.round(amount);
  }
  return Number(amount.toFixed(2));
}

export function convertUsdToLocalAmount(
  usdAmount: number,
  currency: string,
  usdToLocalRate: number,
  /** Optional — supply countryCode to apply developed/developing tier multiplier. */
  countryCode?: string,
): number {
  if (usdAmount <= 0) {
    return 0;
  }
  const c = currency.toUpperCase();
  const tier = countryCode ? getCountryPricingTier(countryCode) : 1.0;
  if (c === 'USD') {
    // For USD countries, apply tier directly (no FX conversion)
    return roundForCurrency(usdAmount * tier, c);
  }
  return roundForCurrency(applyFxMarkup(usdAmount, usdToLocalRate, tier), c);
}
