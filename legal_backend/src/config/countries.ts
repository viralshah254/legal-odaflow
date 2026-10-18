export interface CountryConfig {
  code: string;
  name: string;
  currency: string;
  currencySymbol: string;
  defaultLocale: string;
  dataRegion: string;
  timezone: string;
  paymentProviders: string[];
  defaultPaymentProvider: string;
  consumerFreePreviews: number;
  supportedJurisdictions: string[];
  legalDisclaimerLocale: string;
  supportedUiLocales: string[];
}

export const COUNTRY_CONFIGS: Record<string, CountryConfig> = {
  IN: {
    code: 'IN',
    name: 'India',
    currency: 'INR',
    currencySymbol: '₹',
    defaultLocale: 'en-IN',
    dataRegion: 'ap-south-1',
    timezone: 'Asia/Kolkata',
    paymentProviders: ['stripe'],
    defaultPaymentProvider: 'stripe',
    consumerFreePreviews: 3,
    supportedJurisdictions: [
      'Delhi',
      'Maharashtra',
      'Karnataka',
      'Tamil Nadu',
      'West Bengal',
      'Gujarat',
    ],
    legalDisclaimerLocale: 'en-IN',
    supportedUiLocales: ['en', 'hi', 'bn', 'te', 'mr', 'ta', 'gu', 'kn', 'ml', 'ur', 'pa', 'or', 'as'],
  },
  US: {
    code: 'US',
    name: 'United States',
    currency: 'USD',
    currencySymbol: '$',
    defaultLocale: 'en-US',
    dataRegion: 'us-east-1',
    timezone: 'America/New_York',
    paymentProviders: ['stripe'],
    defaultPaymentProvider: 'stripe',
    consumerFreePreviews: 3,
    supportedJurisdictions: [
      'California',
      'New York',
      'Texas',
      'Florida',
      'Illinois',
      'Indiana',
      'Federal',
    ],
    legalDisclaimerLocale: 'en-US',
    supportedUiLocales: ['en', 'fr', 'de'],
  },
  KE: {
    code: 'KE',
    name: 'Kenya',
    currency: 'KES',
    currencySymbol: 'KSh',
    defaultLocale: 'en-KE',
    dataRegion: 'af-south-1',
    timezone: 'Africa/Nairobi',
    paymentProviders: ['mpesa', 'stripe'],
    defaultPaymentProvider: 'mpesa',
    consumerFreePreviews: 3,
    supportedJurisdictions: [
      'Nairobi',
      'Mombasa',
      'Kisumu',
      'Nakuru',
      'Eldoret',
    ],
    legalDisclaimerLocale: 'en-KE',
    supportedUiLocales: ['en', 'fr', 'de'],
  },
  GB: {
    code: 'GB',
    name: 'United Kingdom',
    currency: 'GBP',
    currencySymbol: '£',
    defaultLocale: 'en-GB',
    dataRegion: 'eu-west-2',
    timezone: 'Europe/London',
    paymentProviders: ['stripe'],
    defaultPaymentProvider: 'stripe',
    consumerFreePreviews: 3,
    supportedJurisdictions: ['England & Wales', 'Scotland', 'Northern Ireland'],
    legalDisclaimerLocale: 'en-GB',
    supportedUiLocales: ['en', 'fr', 'de'],
  },
};

export const SUPPORTED_COUNTRY_CODES = Object.keys(COUNTRY_CONFIGS);

export function getCountryConfig(countryCode: string): CountryConfig {
  const config = COUNTRY_CONFIGS[countryCode.toUpperCase()];
  if (!config) {
    throw new Error(`Unsupported country code: ${countryCode}`);
  }
  return config;
}

export function resolveCountryConfig(countryCode?: string | null): CountryConfig {
  if (countryCode && COUNTRY_CONFIGS[countryCode.toUpperCase()]) {
    return COUNTRY_CONFIGS[countryCode.toUpperCase()];
  }
  return COUNTRY_CONFIGS.US;
}

/** Returns the config for supported countries, or a best-effort fallback config for unsupported ones. */
export function resolveCountryConfigBestEffort(countryCode?: string | null): CountryConfig & { isTier1: boolean } {
  const upper = countryCode?.toUpperCase();
  if (upper && COUNTRY_CONFIGS[upper]) {
    return { ...COUNTRY_CONFIGS[upper], isTier1: true };
  }
  // Best-effort: use US as the analysis template but keep the user's country code
  const fallback: CountryConfig & { isTier1: boolean } = {
    ...COUNTRY_CONFIGS.US,
    code: upper ?? 'US',
    name: upper ?? 'Unknown',
    isTier1: false,
  };
  return fallback;
}
