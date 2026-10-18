/** Mirrors backend legal_backend/src/config/currency-fx.util.ts */

export const FX_MARKUP_PERCENT = 1.5

export const FALLBACK_USD_TO_LOCAL: Record<string, number> = {
  USD: 1,
  INR: 83,
  GBP: 0.79,
  KES: 129,
}

export function applyFxMarkup(usdAmount: number, usdToLocalRate: number): number {
  return usdAmount * usdToLocalRate * (1 + FX_MARKUP_PERCENT / 100)
}

export function roundForCurrency(amount: number, currency: string): number {
  const c = currency.toUpperCase()
  if (c === "INR" || c === "KES") {
    return Math.round(amount)
  }
  return Number(amount.toFixed(2))
}

export function convertUsdToLocalAmount(
  usdAmount: number,
  currency: string,
  usdToLocalRate?: number,
): number {
  if (usdAmount <= 0) return 0
  const c = currency.toUpperCase()
  if (c === "USD") return usdAmount
  const rate = usdToLocalRate ?? FALLBACK_USD_TO_LOCAL[c] ?? 1
  return roundForCurrency(applyFxMarkup(usdAmount, rate), c)
}

export function formatMoneyAmount(amount: number, currencyCode: string, symbol: string): string {
  const c = currencyCode.toUpperCase()
  if (c === "INR" || c === "KES") {
    return `${symbol}${Math.round(amount).toLocaleString("en-IN")}`
  }
  return `${symbol}${amount.toFixed(2)}`
}
