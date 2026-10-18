export function computeAiBudgetUsd(
  paymentUsd: number,
  marginPercent = 40,
): number {
  const margin = Math.min(0.95, Math.max(0, marginPercent / 100));
  return Number((paymentUsd * (1 - margin)).toFixed(4));
}

export function computeCreditsFromPayment(
  paymentUsd: number,
  creditUsdValue = 0.01,
  marginPercent = 0,
): number {
  const budget = computeAiBudgetUsd(paymentUsd, marginPercent);
  if (creditUsdValue <= 0) {
    return 0;
  }
  return Math.max(1, Math.floor(budget / creditUsdValue));
}

/**
 * Derive monthly AI credit grant from subscription price.
 * aiBudget = planAmountUsd × (1 − marginPercent/100)
 * credits  = floor(aiBudget / creditUsdValue)
 * e.g. $40 plan, 40% margin, $0.01/credit → floor($24 / $0.01) = 2400 credits
 */
export function computePlanCreditsFromPrice(
  planAmountUsd: number,
  marginPercent = 0,
  creditUsdValue = 0.01,
): number {
  if (planAmountUsd <= 0 || creditUsdValue <= 0) return 0;
  const aiBudgetUsd = planAmountUsd * (1 - Math.min(0.95, Math.max(0, marginPercent / 100)));
  return Math.max(1, Math.floor(aiBudgetUsd / creditUsdValue));
}

/**
 * Compute AI credits for a plan based on market tier budget percentage.
 *
 *  Developing nations (KE, IN, …): tierBudgetPercent = 60
 *    → credits = planAmountUsd × 0.60 / creditUsdValue
 *    e.g. $25 plan: $15 AI budget → $15 / $0.01 = 1500 credits
 *
 *  Developed nations (US, GB, …): tierBudgetPercent = 50
 *    → credits = planAmountUsd × 0.50 / creditUsdValue
 *    e.g. $50 plan: $25 AI budget → $25 / $0.01 = 2500 credits
 *
 * With AI_CREDIT_USD_VALUE=0.01 and AI_PLATFORM_NET_MARGIN_PERCENT=0,
 * credits deplete 1-for-1 with actual provider cost (1 credit = $0.01).
 * Credits run out exactly when provider spend = tierBudgetPercent% of plan price.
 */
export function computePlanCreditsForTier(
  planAmountUsd: number,
  tierBudgetPercent: number,
  creditUsdValue = 0.01,
): number {
  if (planAmountUsd <= 0 || creditUsdValue <= 0 || tierBudgetPercent <= 0) return 0;
  const aiBudgetUsd = planAmountUsd * (tierBudgetPercent / 100);
  return Math.max(1, Math.round(aiBudgetUsd / creditUsdValue));
}

/** Provider API cost (USD) from token counts and model rates. */
export function estimateTokenCostUsd(
  inputPer1M: number,
  outputPer1M: number,
  inputTokens: number,
  outputTokens: number,
): number {
  return Number(
    (
      (inputTokens / 1_000_000) * inputPer1M +
      (outputTokens / 1_000_000) * outputPer1M
    ).toFixed(6),
  );
}

/**
 * Convert provider cost → credits charged to the user.
 * With AI_CREDIT_USD_VALUE=0.01 and margin=0:
 *   credits = ceil(providerCost / 0.01) = providerCost × 100
 * 1 credit = $0.01 of actual provider spend, so credits deplete at the same
 * rate as real AI cost. The platform's profit is the gap between subscription
 * revenue and the AI budget allocated (tierBudgetPercent% of plan price).
 */
/** Default gross margin floor for subscription and top-up pricing. */
export const DEFAULT_SUBSCRIPTION_MARGIN_PERCENT = 40;

/** 1 credit = this many USD of provider API spend at charge time. */
export const DEFAULT_CREDIT_USD_VALUE = 0.01;

/** Offline INR→USD rate used when FX service is unavailable. */
export const DEFAULT_INR_TO_USD = 85;

const LOCAL_CURRENCY_TO_USD: Record<string, number> = {
  USD: 1,
  INR: 1 / DEFAULT_INR_TO_USD,
  GBP: 1.27,
  KES: 0.0077,
};

/**
 * Derive monthly AI credits from a local-currency list price.
 * Converts to USD equivalent, then applies gross margin (default 40%).
 */
export function computeCreditsFromLocalPrice(
  localAmount: number,
  currency: string,
  marginPercent = DEFAULT_SUBSCRIPTION_MARGIN_PERCENT,
  creditUsdValue = DEFAULT_CREDIT_USD_VALUE,
  localToUsd?: number,
): number {
  if (localAmount <= 0) return 0;
  const rate =
    localToUsd ??
    LOCAL_CURRENCY_TO_USD[currency.toUpperCase()] ??
    1;
  const paymentUsd = localAmount * rate;
  return computePlanCreditsFromPrice(paymentUsd, marginPercent, creditUsdValue);
}

export function computeCreditsFromProviderCost(
  providerCostUsd: number,
  creditUsdValue = 0.01,
  netMarginPercent = 0,
  minCredits = 1,
): number {
  if (providerCostUsd <= 0) {
    return minCredits;
  }
  const margin = Math.min(0.95, Math.max(0, netMarginPercent / 100));
  const budgetPerCredit = Number((creditUsdValue * (1 - margin)).toFixed(6));
  if (budgetPerCredit <= 0) {
    return minCredits;
  }
  return Math.max(minCredits, Math.ceil(providerCostUsd / budgetPerCredit));
}
