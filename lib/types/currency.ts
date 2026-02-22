export interface Currency {
  code: string
  symbol: string
  name: string
  locale: string
}

export const CURRENCIES: Record<string, Currency> = {
  KES: { code: "KES", symbol: "KSH", name: "Kenyan Shilling", locale: "en-KE" },
  USD: { code: "USD", symbol: "$", name: "US Dollar", locale: "en-US" },
  GBP: { code: "GBP", symbol: "£", name: "British Pound", locale: "en-GB" },
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
  KE: "KES", // Kenya
  US: "USD", // United States
  GB: "GBP", // United Kingdom
  IE: "EUR", // Ireland
  FR: "EUR", // France
  DE: "EUR", // Germany
  IT: "EUR", // Italy
  ES: "EUR", // Spain
  NL: "EUR", // Netherlands
  BE: "EUR", // Belgium
  AT: "EUR", // Austria
  PT: "EUR", // Portugal
  NG: "NGN", // Nigeria
  ZA: "ZAR", // South Africa
  UG: "UGX", // Uganda
  TZ: "TZS", // Tanzania
  ET: "ETB", // Ethiopia
  GH: "GHS", // Ghana
  // Add more countries as needed
}

// Default currency if detection fails
export const DEFAULT_CURRENCY = "KES"




