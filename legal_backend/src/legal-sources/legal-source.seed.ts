export interface LegalSourceSeed {
  countryCode: string;
  name: string;
  sourceType: string;
  baseUrl?: string;
  apiAvailable?: boolean;
  scrapingAllowed?: boolean;
  licenseTerms?: string;
  refreshFrequency?: string;
}

export const LEGAL_SOURCE_CONNECTOR_SEEDS: LegalSourceSeed[] = [
  {
    countryCode: 'IN',
    name: 'India Code (Legislative Department)',
    sourceType: 'STATUTE',
    baseUrl: 'https://www.indiacode.nic.in',
    apiAvailable: false,
    scrapingAllowed: false,
    licenseTerms: 'Government of India — open access with attribution',
    refreshFrequency: 'WEEKLY',
  },
  {
    countryCode: 'IN',
    name: 'Supreme Court of India',
    sourceType: 'CASE_LAW',
    baseUrl: 'https://main.sci.gov.in',
    apiAvailable: false,
    scrapingAllowed: false,
    licenseTerms: 'Public judgments — verify against official registry',
    refreshFrequency: 'DAILY',
  },
  {
    countryCode: 'US',
    name: 'CourtListener (Free Law Project)',
    sourceType: 'CASE_LAW',
    baseUrl: 'https://www.courtlistener.com',
    apiAvailable: true,
    scrapingAllowed: false,
    licenseTerms: 'CourtListener API terms',
    refreshFrequency: 'DAILY',
  },
  {
    countryCode: 'US',
    name: 'Cornell LII',
    sourceType: 'STATUTE',
    baseUrl: 'https://www.law.cornell.edu',
    apiAvailable: false,
    scrapingAllowed: false,
    licenseTerms: 'Educational use — verify against official sources',
    refreshFrequency: 'WEEKLY',
  },
  {
    countryCode: 'KE',
    name: 'Kenya Law Reports',
    sourceType: 'CASE_LAW',
    baseUrl: 'https://kenyalaw.org',
    apiAvailable: false,
    scrapingAllowed: false,
    licenseTerms: 'National Council for Law Reporting Kenya',
    refreshFrequency: 'WEEKLY',
  },
  {
    countryCode: 'KE',
    name: 'eCitizen Kenya Legal Portal',
    sourceType: 'REGULATION',
    baseUrl: 'https://www.ecitizen.go.ke',
    apiAvailable: false,
    scrapingAllowed: false,
    licenseTerms: 'Government portal — reference only',
    refreshFrequency: 'MONTHLY',
  },
  {
    countryCode: 'GB',
    name: 'Legislation.gov.uk',
    sourceType: 'STATUTE',
    baseUrl: 'https://www.legislation.gov.uk',
    apiAvailable: true,
    scrapingAllowed: false,
    licenseTerms: 'Open Government Licence v3.0',
    refreshFrequency: 'DAILY',
  },
  {
    countryCode: 'GB',
    name: 'BAILII',
    sourceType: 'CASE_LAW',
    baseUrl: 'https://www.bailii.org',
    apiAvailable: false,
    scrapingAllowed: false,
    licenseTerms: 'BAILII terms — non-commercial research',
    refreshFrequency: 'WEEKLY',
  },
];

export const LEGAL_SOURCE_COUNTRY_CODES = ['IN', 'US', 'KE', 'GB'] as const;
