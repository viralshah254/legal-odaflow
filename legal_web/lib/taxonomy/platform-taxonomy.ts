/**
 * Canonical platform taxonomy — single source of truth for practice domains.
 * Synced to legal_backend/src/config/taxonomy/ and legal_web/lib/taxonomy/
 */

export type Tier1Jurisdiction = 'IN' | 'US' | 'KE' | 'GB'

export type TaskPatternFeature =
  | 'research'
  | 'draft'
  | 'review'
  | 'intake'
  | 'copilot'
  | 'law_library'
  | 'section_finder'

export type PlatformAudience = 'professional' | 'student'

export interface PlatformSubdomain {
  slug: string
  label: string
}

export interface PlatformDomain {
  slug: string
  label: string
  audience: PlatformAudience
  jurisdictions: Tier1Jurisdiction[]
  features: TaskPatternFeature[]
  subdomains: PlatformSubdomain[]
  /** Legacy slug aliases → this domain */
  aliases: string[]
  /** Statute-registry practice tags that map to this domain */
  statuteTags: string[]
}

export const TIER1_JURISDICTIONS: Tier1Jurisdiction[] = ['IN', 'US', 'KE', 'GB']

export const TASK_PATTERN_FEATURES: TaskPatternFeature[] = [
  'research',
  'draft',
  'review',
  'intake',
  'law_library',
  'section_finder',
  'copilot',
]

/** Features supported per jurisdiction (section_finder: all tier-1 jurisdictions). */
export function featuresForJurisdiction(
  jurisdiction: Tier1Jurisdiction,
  domainFeatures: TaskPatternFeature[],
): TaskPatternFeature[] {
  return domainFeatures.filter((f) => {
    if (f === 'section_finder') return TIER1_JURISDICTIONS.includes(jurisdiction)
    return true
  })
}

export const PLATFORM_DOMAINS: PlatformDomain[] = [
  {
    slug: 'litigation_disputes',
    label: 'Litigation — Civil & Criminal',
    audience: 'professional',
    jurisdictions: TIER1_JURISDICTIONS,
    features: ['research', 'draft', 'review', 'intake', 'law_library', 'section_finder', 'copilot'],
    subdomains: [
      { slug: 'case_strategy', label: 'Case Strategy & Assessment' },
      { slug: 'civil_suits', label: 'Civil Suits & Commercial Disputes' },
      { slug: 'injunctions', label: 'Injunctions & Interim Relief' },
      { slug: 'evidence_witnesses', label: 'Evidence & Witnesses' },
      { slug: 'criminal_fir_bail', label: 'Criminal — FIR, Bail & Trial' },
      { slug: 'appeals_revision', label: 'Appeals, Revision & Enforcement' },
      { slug: 'settlement', label: 'Settlement & Negotiation' },
    ],
    aliases: ['litigation', 'civil_litigation', 'criminal', 'criminal_defense', 'criminal_procedure', 'bail'],
    statuteTags: ['civil_litigation', 'criminal', 'criminal_procedure', 'torts', 'evidence'],
  },
  {
    slug: 'pleadings_notices',
    label: 'Drafting — Pleadings & Notices',
    audience: 'professional',
    jurisdictions: TIER1_JURISDICTIONS,
    features: ['research', 'draft', 'review', 'intake', 'copilot'],
    subdomains: [
      { slug: 'plaints_petitions', label: 'Plaints & Petitions' },
      { slug: 'written_statements', label: 'Written Statements & Replies' },
      { slug: 'applications_affidavits', label: 'Applications & Affidavits' },
      { slug: 'legal_notices', label: 'Legal Notices & Replies' },
    ],
    aliases: ['pleadings', 'notices'],
    statuteTags: ['civil_litigation', 'criminal_procedure'],
  },
  {
    slug: 'consumer',
    label: 'Consumer Complaints',
    audience: 'professional',
    jurisdictions: TIER1_JURISDICTIONS,
    features: ['research', 'draft', 'review', 'intake', 'law_library', 'copilot'],
    subdomains: [{ slug: 'consumer_complaints', label: 'Consumer Complaints' }],
    aliases: ['consumer_protection'],
    statuteTags: ['consumer'],
  },
  {
    slug: 'arbitration_adr',
    label: 'Arbitration & ADR',
    audience: 'professional',
    jurisdictions: TIER1_JURISDICTIONS,
    features: ['research', 'draft', 'review', 'intake', 'copilot'],
    subdomains: [
      { slug: 'arbitration', label: 'Arbitration' },
      { slug: 'mediation', label: 'Mediation & Conciliation' },
    ],
    aliases: ['adr', 'arbitration'],
    statuteTags: ['adr'],
  },
  {
    slug: 'corporate_commercial',
    label: 'Corporate & Commercial',
    audience: 'professional',
    jurisdictions: TIER1_JURISDICTIONS,
    features: ['research', 'draft', 'review', 'intake', 'law_library', 'copilot'],
    subdomains: [
      { slug: 'company_law', label: 'Company Law & Secretarial' },
      { slug: 'board_shareholder', label: 'Board & Shareholder Matters' },
      { slug: 'commercial_contracts', label: 'Commercial Contracts' },
      { slug: 'compliance_filings', label: 'Compliance & Filings' },
    ],
    aliases: ['corporate', 'commercial', 'contract'],
    statuteTags: ['corporate', 'commercial', 'contract', 'securities'],
  },
  {
    slug: 'banking_finance',
    label: 'Banking, Finance & Capital Markets',
    audience: 'professional',
    jurisdictions: TIER1_JURISDICTIONS,
    features: ['research', 'draft', 'review', 'intake', 'law_library', 'copilot'],
    subdomains: [
      { slug: 'loan_security', label: 'Loan & Security Documentation' },
      { slug: 'debt_recovery', label: 'Debt Recovery & SARFAESI' },
      { slug: 'sebi_compliance', label: 'SEBI Compliance' },
      { slug: 'ipo_listing', label: 'IPO & Listing' },
      { slug: 'investment_funds', label: 'Investment Funds & AIFs' },
    ],
    aliases: ['banking', 'finance', 'capital_markets', 'securities'],
    statuteTags: ['banking', 'securities', 'financial'],
  },
  {
    slug: 'insolvency',
    label: 'Insolvency & IBC',
    audience: 'professional',
    jurisdictions: ['IN', 'US', 'GB'] as Tier1Jurisdiction[],
    features: ['research', 'draft', 'review', 'intake', 'law_library', 'copilot'],
    subdomains: [
      { slug: 'cirp', label: 'CIRP Applications & Claims' },
      { slug: 'coc_resolution', label: 'CoC & Resolution Plans' },
      { slug: 'liquidation', label: 'Liquidation & Avoidance Actions' },
      { slug: 'nclt_practice', label: 'NCLT/NCLAT Practice' },
    ],
    aliases: ['insolvency_ibc', 'bankruptcy'],
    statuteTags: ['insolvency', 'bankruptcy'],
  },
  {
    slug: 'tax',
    label: 'Tax',
    audience: 'professional',
    jurisdictions: TIER1_JURISDICTIONS,
    features: ['research', 'draft', 'review', 'intake', 'law_library', 'copilot'],
    subdomains: [
      { slug: 'income_tax', label: 'Income Tax' },
      { slug: 'gst', label: 'GST' },
      { slug: 'assessments_appeals', label: 'Notices, Assessments & Appeals' },
      { slug: 'transfer_pricing', label: 'Transfer Pricing & International Tax' },
    ],
    aliases: ['taxation', 'tax_revenue'],
    statuteTags: ['taxation', 'tax'],
  },
  {
    slug: 'intellectual_property',
    label: 'Intellectual Property',
    audience: 'professional',
    jurisdictions: TIER1_JURISDICTIONS,
    features: ['research', 'draft', 'review', 'intake', 'law_library', 'copilot'],
    subdomains: [
      { slug: 'trademarks', label: 'Trademarks' },
      { slug: 'copyright', label: 'Copyright' },
      { slug: 'patents', label: 'Patents' },
      { slug: 'ip_agreements', label: 'IP Agreements & Enforcement' },
    ],
    aliases: ['ip', 'intellectual_property'],
    statuteTags: ['intellectual_property', 'ip', 'technology'],
  },
  {
    slug: 'employment_labour',
    label: 'Employment & Labour',
    audience: 'professional',
    jurisdictions: TIER1_JURISDICTIONS,
    features: ['research', 'draft', 'review', 'intake', 'law_library', 'section_finder', 'copilot'],
    subdomains: [
      { slug: 'contracts_policies', label: 'Contracts & Policies' },
      { slug: 'posh', label: 'POSH' },
      { slug: 'termination_disputes', label: 'Termination & Disputes' },
      { slug: 'statutory_compliance', label: 'Statutory Compliance' },
    ],
    aliases: ['employment', 'labour', 'labor'],
    statuteTags: ['employment', 'industrial', 'labour'],
  },
  {
    slug: 'family_matrimonial',
    label: 'Family & Matrimonial',
    audience: 'professional',
    jurisdictions: TIER1_JURISDICTIONS,
    features: ['research', 'draft', 'review', 'intake', 'law_library', 'copilot'],
    subdomains: [
      { slug: 'divorce_separation', label: 'Divorce & Separation' },
      { slug: 'maintenance_custody', label: 'Maintenance & Custody' },
    ],
    aliases: ['family', 'matrimonial'],
    statuteTags: ['family'],
  },
  {
    slug: 'real_estate_property',
    label: 'Real Estate',
    audience: 'professional',
    jurisdictions: TIER1_JURISDICTIONS,
    features: ['research', 'draft', 'review', 'intake', 'law_library', 'copilot'],
    subdomains: [
      { slug: 'title_dd', label: 'Title Due Diligence' },
      { slug: 'sale_lease', label: 'Sale, Lease & Conveyancing' },
      { slug: 'rera_approvals', label: 'RERA & Approvals' },
    ],
    aliases: ['property', 'real_estate', 'conveyancing', 'housing'],
    statuteTags: ['property', 'conveyancing', 'housing'],
  },
  {
    slug: 'regulatory_compliance',
    label: 'Regulatory & Compliance',
    audience: 'professional',
    jurisdictions: TIER1_JURISDICTIONS,
    features: ['research', 'draft', 'review', 'intake', 'law_library', 'copilot'],
    subdomains: [
      { slug: 'fema_fdi', label: 'FEMA & FDI' },
      { slug: 'dpdpa', label: 'Data Protection (DPDPA)' },
      { slug: 'competition_cci', label: 'Competition Law & CCI' },
      { slug: 'environmental', label: 'Environmental' },
      { slug: 'aml_pmla', label: 'AML, PMLA & Sector Regulators' },
    ],
    aliases: ['regulatory', 'compliance', 'privacy', 'environmental', 'administrative', 'constitutional'],
    statuteTags: ['regulatory', 'privacy', 'environmental', 'administrative', 'constitutional', 'antitrust'],
  },
  {
    slug: 'startups',
    label: 'Startups',
    audience: 'professional',
    jurisdictions: TIER1_JURISDICTIONS,
    features: ['research', 'draft', 'review', 'intake', 'copilot'],
    subdomains: [
      { slug: 'incorporation_founders', label: 'Incorporation & Founders' },
      { slug: 'fundraising_esop', label: 'Fundraising & ESOPs' },
      { slug: 'startup_contracts', label: 'Contracts & Compliance' },
    ],
    aliases: ['startup'],
    statuteTags: ['corporate', 'commercial', 'technology'],
  },
  {
    slug: 'white_collar',
    label: 'White Collar & Investigations',
    audience: 'professional',
    jurisdictions: ['IN', 'US', 'GB'] as Tier1Jurisdiction[],
    features: ['research', 'draft', 'review', 'intake', 'copilot'],
    subdomains: [
      { slug: 'internal_investigations', label: 'Internal Investigations' },
      { slug: 'ed_cbi_pmla', label: 'ED/CBI & PMLA Response' },
      { slug: 'fraud_compliance', label: 'Fraud & Compliance Programs' },
    ],
    aliases: ['white_collar', 'investigations', 'fraud'],
    statuteTags: ['criminal', 'regulatory'],
  },
  {
    slug: 'wills_estates_probate',
    label: 'Wills, Trusts & Estate Planning',
    audience: 'professional',
    jurisdictions: TIER1_JURISDICTIONS,
    features: ['research', 'draft', 'review', 'intake', 'law_library', 'copilot'],
    subdomains: [
      { slug: 'wills_trusts', label: 'Wills, Trusts & Estate Planning' },
      { slug: 'succession_probate', label: 'Succession & Probate' },
    ],
    aliases: ['probate_estates', 'wills', 'estates', 'probate'],
    statuteTags: ['family'],
  },
  {
    slug: 'immigration',
    label: 'Immigration',
    audience: 'professional',
    jurisdictions: ['US', 'GB', 'IN'] as Tier1Jurisdiction[],
    features: ['research', 'draft', 'review', 'intake', 'law_library', 'copilot'],
    subdomains: [{ slug: 'immigration_filings', label: 'Immigration Filings & Advisories' }],
    aliases: [],
    statuteTags: ['immigration'],
  },
  {
    slug: 'private_client_nri',
    label: 'Private Client & NRI',
    audience: 'professional',
    jurisdictions: ['IN'] as Tier1Jurisdiction[],
    features: ['research', 'draft', 'review', 'intake', 'law_library', 'copilot'],
    subdomains: [
      { slug: 'oci_nri_status', label: 'OCI & NRI Status' },
      { slug: 'nri_property', label: 'NRI Property & Repatriation' },
      { slug: 'cross_border_estates', label: 'Cross-Border Wills & Succession' },
      { slug: 'nri_tax_fema', label: 'NRI Tax & FEMA Compliance' },
    ],
    aliases: ['nri', 'private_client', 'oci'],
    statuteTags: ['family', 'property', 'regulatory', 'taxation'],
  },
  {
    slug: 'international_practice',
    label: 'International Practice',
    audience: 'professional',
    jurisdictions: ['IN', 'US', 'GB'] as Tier1Jurisdiction[],
    features: ['research', 'draft', 'review', 'intake', 'copilot'],
    subdomains: [
      { slug: 'cross_border_disputes', label: 'Cross-Border Disputes' },
      { slug: 'foreign_awards_decrees', label: 'Foreign Awards & Decree Enforcement' },
      { slug: 'anti_suit_injunctions', label: 'Anti-Suit Injunctions' },
      { slug: 'international_arbitration', label: 'International Arbitration' },
    ],
    aliases: ['international', 'cross_border'],
    statuteTags: ['adr', 'corporate', 'regulatory'],
  },
  {
    slug: 'general_usage',
    label: 'General Usage',
    audience: 'professional',
    jurisdictions: TIER1_JURISDICTIONS,
    features: ['research', 'review', 'copilot'],
    subdomains: [
      { slug: 'summarisation', label: 'Summarisation' },
      { slug: 'document_qa', label: 'Document Q&A & Extraction' },
      { slug: 'comparison', label: 'Comparison & Chronologies' },
      { slug: 'emails', label: 'Emails & Client Communication' },
      { slug: 'quick_research', label: 'Quick Research' },
      { slug: 'simplification', label: 'Simplification & Explainers' },
    ],
    aliases: ['general'],
    statuteTags: [],
  },
  // Phase 5 — student stubs (patterns deferred)
  {
    slug: 'student_academic',
    label: 'Student — Academic & Skills',
    audience: 'student',
    jurisdictions: TIER1_JURISDICTIONS,
    features: ['research', 'draft', 'copilot'],
    subdomains: [
      { slug: 'concept_mastery', label: 'Concept Mastery' },
      { slug: 'reading_briefing', label: 'Reading & Briefing Cases' },
      { slug: 'legal_research', label: 'Legal Research & Finding the Law' },
      { slug: 'academic_writing', label: 'Academic Writing & Publishing' },
      { slug: 'citation', label: 'Citation & Footnoting' },
      { slug: 'mooting', label: 'Mooting, MUNs & Competitions' },
      { slug: 'drafting_fundamentals', label: 'Drafting Fundamentals' },
      { slug: 'internships', label: 'Internships & On the Job' },
      { slug: 'exam_prep', label: 'Exam Preparation' },
    ],
    aliases: ['student'],
    statuteTags: [],
  },
]

export const PROFESSIONAL_DOMAINS = PLATFORM_DOMAINS.filter((d) => d.audience === 'professional')

export const PLATFORM_DOMAIN_BY_SLUG = Object.fromEntries(
  PLATFORM_DOMAINS.map((d) => [d.slug, d]),
) as Record<string, PlatformDomain>

/** Build alias → canonical slug map */
const ALIAS_MAP: Record<string, string> = {}
for (const domain of PLATFORM_DOMAINS) {
  ALIAS_MAP[domain.slug] = domain.slug
  for (const alias of domain.aliases) {
    ALIAS_MAP[alias.toLowerCase()] = domain.slug
  }
}
// Legacy mappings from fragmented vocabularies
ALIAS_MAP['criminal_defence'] = 'litigation_disputes'
ALIAS_MAP['criminal_defense'] = 'litigation_disputes'
ALIAS_MAP['litigation'] = 'litigation_disputes'
ALIAS_MAP['probate_estates'] = 'wills_estates_probate'
ALIAS_MAP['tax_revenue'] = 'tax'
ALIAS_MAP['private_client_nri'] = 'private_client_nri'
ALIAS_MAP['nri'] = 'private_client_nri'
ALIAS_MAP['international_practice'] = 'international_practice'
ALIAS_MAP['international'] = 'international_practice'
ALIAS_MAP['sector_specific'] = 'regulatory_compliance'
ALIAS_MAP['banking_finance_debts'] = 'banking_finance'

export function resolvePracticeAreaSlug(input: string | undefined | null): string {
  if (!input?.trim()) return 'general_usage'
  const key = input.trim().toLowerCase().replace(/\s+/g, '_')
  return ALIAS_MAP[key] ?? key
}

export function domainLabel(slug: string): string {
  return PLATFORM_DOMAIN_BY_SLUG[slug]?.label ?? slug.replace(/_/g, ' ')
}

export function domainsForJurisdiction(
  jurisdiction: Tier1Jurisdiction,
  feature?: TaskPatternFeature,
  audience: PlatformAudience = 'professional',
): PlatformDomain[] {
  return PLATFORM_DOMAINS.filter((d) => {
    if (d.audience !== audience) return false
    if (!d.jurisdictions.includes(jurisdiction)) return false
    if (feature && !featuresForJurisdiction(jurisdiction, d.features).includes(feature)) return false
    return true
  })
}

export interface PracticeAreaOption {
  slug: string
  label: string
}

/** Firm matter / template practice area dropdown options */
export function practiceAreaOptions(audience: PlatformAudience = 'professional'): PracticeAreaOption[] {
  return PLATFORM_DOMAINS.filter((d) => d.audience === audience).map((d) => ({
    slug: d.slug,
    label: d.label,
  }))
}

export const PRACTICE_AREAS = practiceAreaOptions('professional')
export const PRACTICE_AREA_SLUGS = PRACTICE_AREAS.map((a) => a.slug)
export const PRACTICE_AREA_LABEL_BY_SLUG = Object.fromEntries(
  PRACTICE_AREAS.map((a) => [a.slug, a.label]),
) as Record<string, string>

export function practiceAreaLabel(slug: string): string {
  return PRACTICE_AREA_LABEL_BY_SLUG[slug] ?? domainLabel(slug)
}

/** Legal forms catalog filter slugs (includes legacy aliases used in catalog.data.json) */
export function legalFormsPracticeAreaSlugs(): string[] {
  const slugs = new Set<string>()
  for (const d of PROFESSIONAL_DOMAINS) {
    slugs.add(d.slug)
    for (const alias of d.aliases) slugs.add(alias)
  }
  slugs.add('constitutional')
  slugs.add('bankruptcy')
  return [...slugs].sort()
}
