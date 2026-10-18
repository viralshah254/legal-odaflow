export interface Currency {
  code: string
  symbol: string
  name: string
  locale: string
}

export const CURRENCIES: Record<string, Currency> = {
  KES: { code: "KES", symbol: "KSh", name: "Kenyan Shilling", locale: "en-KE" },
  USD: { code: "USD", symbol: "$", name: "US Dollar", locale: "en-US" },
  GBP: { code: "GBP", symbol: "£", name: "British Pound", locale: "en-GB" },
  INR: { code: "INR", symbol: "₹", name: "Indian Rupee", locale: "en-IN" },
  EUR: { code: "EUR", symbol: "€", name: "Euro", locale: "en-EU" },
  NGN: { code: "NGN", symbol: "₦", name: "Nigerian Naira", locale: "en-NG" },
  ZAR: { code: "ZAR", symbol: "R", name: "South African Rand", locale: "en-ZA" },
  UGX: { code: "UGX", symbol: "USh", name: "Ugandan Shilling", locale: "en-UG" },
  TZS: { code: "TZS", symbol: "TSh", name: "Tanzanian Shilling", locale: "en-TZ" },
  ETB: { code: "ETB", symbol: "Br", name: "Ethiopian Birr", locale: "en-ET" },
  GHS: { code: "GHS", symbol: "₵", name: "Ghanaian Cedi", locale: "en-GH" },
}

// Map country codes to currencies
export const COUNTRY_TO_CURRENCY: Record<string, string> = {
  KE: "KES",
  US: "USD",
  GB: "GBP",
  IN: "INR",
  IE: "EUR",
  FR: "EUR",
  DE: "EUR",
  IT: "EUR",
  ES: "EUR",
  NL: "EUR",
  BE: "EUR",
  AT: "EUR",
  PT: "EUR",
  NG: "NGN",
  ZA: "ZAR",
  UG: "UGX",
  TZ: "TZS",
  ET: "ETB",
  GH: "GHS",
}

/** Resolve a currency code to display metadata; falls back to code as symbol. */
export function resolveCurrency(code: string): Currency {
  const normalized = code.toUpperCase()
  if (CURRENCIES[normalized]) {
    return CURRENCIES[normalized]
  }
  try {
    const parts = new Intl.NumberFormat("en", {
      style: "currency",
      currency: normalized,
      currencyDisplay: "narrowSymbol",
    }).formatToParts(0)
    const symbol = parts.find((p) => p.type === "currency")?.value ?? normalized
    return {
      code: normalized,
      symbol,
      name: normalized,
      locale: "en-US",
    }
  } catch {
    return {
      code: normalized,
      symbol: normalized,
      name: normalized,
      locale: "en-US",
    }
  }
}

// Default currency if detection fails
export const DEFAULT_CURRENCY = "USD"




