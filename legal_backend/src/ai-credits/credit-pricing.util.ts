export function computeAiBudgetUsd(
  paymentUsd: number,
  marginPercent = 40,
): number {
  const margin = Math.min(0.95, Math.max(0, marginPercent / 100));
  return Number((paymentUsd * (1 - margin)).toFixed(4));
}

export function computeCreditsFromPayment(
  paymentUsd: number,
  creditUsdValue = 0.06,
  marginPercent = 40,
): number {
  const budget = computeAiBudgetUsd(paymentUsd, marginPercent);
  if (creditUsdValue <= 0) {
    return 0;
  }
  return Math.max(1, Math.floor(budget / creditUsdValue));
}
