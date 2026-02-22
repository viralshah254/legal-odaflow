import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// These functions are now deprecated - use useCurrency hook and formatCurrencyWithSymbol instead
// Keeping for backward compatibility but they will use KES as default
export function formatCurrency(amount: number, currencyCode: string = "KES", symbol: string = "KSH"): string {
  const currency = currencyCode === "KES" ? "en-KE" : currencyCode === "USD" ? "en-US" : currencyCode === "GBP" ? "en-GB" : "en-US"
  const formatted = new Intl.NumberFormat(currency, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
  return `${symbol} ${formatted}`
}

export function formatKSH(amount: number, currencyCode: string = "KES", symbol: string = "KSH"): string {
  const formatted = (amount / 1000).toFixed(0)
  return `${symbol} ${formatted}K`
}

/**
 * Format currency with the provided currency object
 * This is the recommended way to format currency
 */
export function formatCurrencyWithSymbol(amount: number, currency: { code: string; symbol: string; locale: string }): string {
  const formatted = new Intl.NumberFormat(currency.locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
  return `${currency.symbol} ${formatted}`
}

/**
 * Format currency in short form (e.g., "KSH 250K")
 */
export function formatCurrencyShort(amount: number, currency: { symbol: string }): string {
  const formatted = (amount / 1000).toFixed(0)
  return `${currency.symbol} ${formatted}K`
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date))
}

export function formatDateTime(date: Date | string): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Format a number with comma separators for display in input fields
 * @param value - The numeric value or string to format
 * @returns Formatted string with commas (e.g., "1,000,000")
 */
export function formatNumberWithCommas(value: string | number): string {
  if (value === "" || value === null || value === undefined) return ""
  const numStr = typeof value === "number" ? value.toString() : value.toString().replace(/,/g, "")
  if (numStr === "" || isNaN(Number(numStr))) return ""
  const num = parseFloat(numStr)
  if (isNaN(num)) return ""
  // Format with commas, but allow decimals
  const parts = numStr.split(".")
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  return parts.join(".")
}

/**
 * Parse a comma-separated number string back to a number
 * @param value - The formatted string (e.g., "1,000,000")
 * @returns The numeric value
 */
export function parseCommaNumber(value: string): number {
  if (!value) return 0
  const cleaned = value.replace(/,/g, "")
  const num = parseFloat(cleaned)
  return isNaN(num) ? 0 : num
}

