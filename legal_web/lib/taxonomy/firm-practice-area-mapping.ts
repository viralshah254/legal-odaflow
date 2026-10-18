/**
 * Maps firm-facing practice area labels (as shown on law firm websites)
 * to Umbrella's internal platform taxonomy slugs.
 */
export interface FirmPracticeAreaMapping {
  /** Label as shown on a typical Indian full-service firm website */
  firmLabel: string
  /** Canonical platform domain slug(s) */
  taxonomySlugs: string[]
}

export const INDIA_FIRM_PRACTICE_AREA_MAPPINGS: FirmPracticeAreaMapping[] = [
  {
    firmLabel: 'Real Estate & Property Law',
    taxonomySlugs: ['real_estate_property'],
  },
  {
    firmLabel: 'Dispute Resolution & Arbitration',
    taxonomySlugs: ['arbitration_adr', 'litigation_disputes'],
  },
  {
    firmLabel: 'Corporate Law & Foreign Investment',
    taxonomySlugs: ['corporate_commercial', 'regulatory_compliance', 'startups'],
  },
  {
    firmLabel: 'Commercial Law',
    taxonomySlugs: ['corporate_commercial', 'litigation_disputes', 'consumer'],
  },
  {
    firmLabel: 'Intellectual Property, IT & Technology',
    taxonomySlugs: ['intellectual_property', 'regulatory_compliance'],
  },
  {
    firmLabel: 'Private Client & NRI Legal Services',
    taxonomySlugs: ['private_client_nri', 'wills_estates_probate', 'family_matrimonial'],
  },
  {
    firmLabel: 'International Practice',
    taxonomySlugs: ['international_practice', 'arbitration_adr', 'tax'],
  },
  {
    firmLabel: 'Banking, Finance & Debts',
    taxonomySlugs: ['banking_finance', 'insolvency'],
  },
  {
    firmLabel: 'Sector-Specific Expertise',
    taxonomySlugs: ['regulatory_compliance', 'corporate_commercial'],
  },
]

/** Resolve firm website label → primary taxonomy slug */
export function resolveFirmPracticeArea(firmLabel: string): string {
  const normalized = firmLabel.trim().toLowerCase()
  const match = INDIA_FIRM_PRACTICE_AREA_MAPPINGS.find(
    (m) => m.firmLabel.toLowerCase() === normalized,
  )
  if (match) return match.taxonomySlugs[0]!
  return 'general_usage'
}

/** All taxonomy slugs covered by a firm label (may be multiple) */
export function taxonomySlugsForFirmLabel(firmLabel: string): string[] {
  const normalized = firmLabel.trim().toLowerCase()
  const match = INDIA_FIRM_PRACTICE_AREA_MAPPINGS.find(
    (m) => m.firmLabel.toLowerCase() === normalized,
  )
  return match?.taxonomySlugs ?? ['general_usage']
}
