/** SEO country landing pages — maps URL segment to jurisdiction config. */
export const COUNTRY_MARKET_CODES = ["in", "us", "gb", "ke"] as const
export type CountryMarketCode = (typeof COUNTRY_MARKET_CODES)[number]

export interface CountryMarketConfig {
  code: CountryMarketCode
  /** URL path segment, e.g. /in/ */
  path: `/${CountryMarketCode}`
  label: string
  flag: string
  /** ISO 3166-1 alpha-2 for structured data */
  countryCode: string
  openGraphLocale: string
  /** Primary SEO keywords for this market */
  keywords: string[]
  /** i18n key under marketing.countryPages.{code} */
  i18nKey: CountryMarketCode
}

export const COUNTRY_MARKETS: Record<CountryMarketCode, CountryMarketConfig> = {
  in: {
    code: "in",
    path: "/in",
    label: "India",
    flag: "🇮🇳",
    countryCode: "IN",
    openGraphLocale: "en_IN",
    keywords: [
      "legal AI India",
      "Indian legal help",
      "legal issue checker India",
      "AI lawyer India",
      "legal advice without lawyer India",
      "law firm software India",
      "IPC section finder",
      "FIR analysis India",
      "legal AI Hindi",
    ],
    i18nKey: "in",
  },
  us: {
    code: "us",
    path: "/us",
    label: "United States",
    flag: "🇺🇸",
    countryCode: "US",
    openGraphLocale: "en_US",
    keywords: [
      "legal AI US",
      "legal AI United States",
      "legal help without lawyer",
      "free legal issue checker",
      "law firm AI software",
      "legal copilot USA",
      "AI legal assistant America",
      "small claims help",
    ],
    i18nKey: "us",
  },
  gb: {
    code: "gb",
    path: "/gb",
    label: "United Kingdom",
    flag: "🇬🇧",
    countryCode: "GB",
    openGraphLocale: "en_GB",
    keywords: [
      "legal AI UK",
      "legal AI United Kingdom",
      "legal help UK",
      "employment tribunal help",
      "law firm software UK",
      "legal issue checker UK",
      "AI legal assistant Britain",
      "housing disrepair UK",
    ],
    i18nKey: "gb",
  },
  ke: {
    code: "ke",
    path: "/ke",
    label: "Kenya",
    flag: "🇰🇪",
    countryCode: "KE",
    openGraphLocale: "en_KE",
    keywords: [
      "legal AI Kenya",
      "legal help Kenya",
      "Kenya legal advice",
      "law firm software Kenya",
      "legal issue checker Kenya",
      "Employment Act Kenya",
      "M-Pesa legal platform",
      "AI legal assistant Kenya",
    ],
    i18nKey: "ke",
  },
}

export function isCountryMarketCode(value: string): value is CountryMarketCode {
  return (COUNTRY_MARKET_CODES as readonly string[]).includes(value.toLowerCase())
}

export function getCountryMarket(code: string): CountryMarketConfig | null {
  const key = code.toLowerCase()
  return isCountryMarketCode(key) ? COUNTRY_MARKETS[key] : null
}
