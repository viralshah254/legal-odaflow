export type KenyaBenchmarkCategory =
  | 'constitutional'
  | 'employment'
  | 'land'
  | 'procedure'
  | 'county_law'
  | 'privacy'
  | 'historical_version'
  | 'gazette_commencement'
  | 'bill_as_law'
  | 'fake_citation';

export interface KenyaBenchmarkAuthority {
  key: string;
  aliases: readonly string[];
  authorityClass:
    | 'CONSTITUTION'
    | 'ACT'
    | 'SUBSIDIARY_LEGISLATION'
    | 'GAZETTE'
    | 'CASE';
}

export interface KenyaResearchBenchmarkCase {
  id: string;
  category: KenyaBenchmarkCategory;
  query: string;
  countryCode: 'KE';
  requiredAuthorities: readonly KenyaBenchmarkAuthority[];
  requiredEvidence: readonly string[];
  forbiddenAuthorityLevels: readonly string[];
  asOfDate?: string;
  shouldAbstain?: boolean;
  advocateReviewStatus: 'PENDING' | 'APPROVED';
}

const authority = (
  key: string,
  authorityClass: KenyaBenchmarkAuthority['authorityClass'],
  ...aliases: string[]
): KenyaBenchmarkAuthority => ({ key, authorityClass, aliases: [key, ...aliases] });

/**
 * Engineering fixtures only. Golden answers remain PENDING until reviewed by
 * a Kenyan advocate and must not be used to represent legal approval.
 */
export const KENYA_RESEARCH_BENCHMARK_MANIFEST: readonly KenyaResearchBenchmarkCase[] = [
  {
    id: 'ke-constitutional-fair-administrative-action',
    category: 'constitutional',
    query: 'What Kenyan constitutional and statutory duties govern fair administrative action?',
    countryCode: 'KE',
    requiredAuthorities: [
      authority('constitution-article-47', 'CONSTITUTION', 'Constitution of Kenya Article 47'),
      authority('fair-administrative-action-act', 'ACT', 'Fair Administrative Action Act'),
    ],
    requiredEvidence: ['current expression', 'commencement', 'appellate authority'],
    forbiddenAuthorityLevels: ['OFFICIAL_PROSPECTIVE', 'SECONDARY'],
    advocateReviewStatus: 'PENDING',
  },
  {
    id: 'ke-employment-termination',
    category: 'employment',
    query: 'Assess procedural and substantive fairness of an employee termination in Kenya.',
    countryCode: 'KE',
    requiredAuthorities: [
      authority('employment-act-section-41', 'ACT', 'Employment Act section 41'),
      authority('employment-act-section-45', 'ACT', 'Employment Act section 45'),
    ],
    requiredEvidence: ['ELRC or appellate case', 'current Act', 'remedies'],
    forbiddenAuthorityLevels: ['OFFICIAL_PROSPECTIVE', 'SECONDARY'],
    advocateReviewStatus: 'PENDING',
  },
  {
    id: 'ke-land-title',
    category: 'land',
    query: 'When may a Kenyan certificate of title be challenged for fraud or illegality?',
    countryCode: 'KE',
    requiredAuthorities: [
      authority('land-registration-act-section-26', 'ACT', 'Land Registration Act section 26'),
    ],
    requiredEvidence: ['ELC or appellate case', 'registered-title framework'],
    forbiddenAuthorityLevels: ['OFFICIAL_PROSPECTIVE', 'SECONDARY'],
    advocateReviewStatus: 'PENDING',
  },
  {
    id: 'ke-procedure-interlocutory-injunction',
    category: 'procedure',
    query: 'What authorities and filing requirements govern an interlocutory injunction in Kenya?',
    countryCode: 'KE',
    requiredAuthorities: [
      authority('civil-procedure-rules-order-40', 'SUBSIDIARY_LEGISLATION', 'Order 40'),
      authority('giella-v-cassman-brown', 'CASE', 'Giella v Cassman Brown'),
    ],
    requiredEvidence: ['enabling Act', 'current rules', 'practice directions', 'filing forum'],
    forbiddenAuthorityLevels: ['OFFICIAL_PROSPECTIVE', 'SECONDARY'],
    advocateReviewStatus: 'PENDING',
  },
  {
    id: 'ke-county-finance-competence',
    category: 'county_law',
    query: 'Can a county impose this charge under its current Finance Act?',
    countryCode: 'KE',
    requiredAuthorities: [
      authority('constitution-fourth-schedule', 'CONSTITUTION', 'Fourth Schedule'),
    ],
    requiredEvidence: ['county instrument', 'national enabling law', 'competence allocation'],
    forbiddenAuthorityLevels: ['OFFICIAL_PROSPECTIVE', 'SECONDARY'],
    advocateReviewStatus: 'PENDING',
  },
  {
    id: 'ke-privacy-cross-border-transfer',
    category: 'privacy',
    query: 'What safeguards apply to transferring Kenyan personal data outside Kenya?',
    countryCode: 'KE',
    requiredAuthorities: [
      authority('data-protection-act-sections-48-49', 'ACT', 'Data Protection Act sections 48 and 49'),
    ],
    requiredEvidence: ['current Act', 'subsidiary regulations', 'ODPC guidance classification'],
    forbiddenAuthorityLevels: ['OFFICIAL_PROSPECTIVE', 'SECONDARY'],
    advocateReviewStatus: 'PENDING',
  },
  {
    id: 'ke-historical-expression',
    category: 'historical_version',
    query: 'What did section 35 of the relevant Act provide on 12 June 2021?',
    countryCode: 'KE',
    requiredAuthorities: [],
    requiredEvidence: ['expression dated on or before query date', 'amendment history'],
    forbiddenAuthorityLevels: ['OFFICIAL_PROSPECTIVE', 'SECONDARY'],
    asOfDate: '2021-06-12',
    shouldAbstain: true,
    advocateReviewStatus: 'PENDING',
  },
  {
    id: 'ke-gazette-commencement',
    category: 'gazette_commencement',
    query: 'Has this enacted Kenyan Act commenced, and on what date?',
    countryCode: 'KE',
    requiredAuthorities: [],
    requiredEvidence: ['verified commencement notice', 'enacted expression'],
    forbiddenAuthorityLevels: ['OFFICIAL_PROSPECTIVE', 'SECONDARY'],
    shouldAbstain: true,
    advocateReviewStatus: 'PENDING',
  },
  {
    id: 'ke-bill-is-not-law',
    category: 'bill_as_law',
    query: 'Apply the Data Protection (Amendment) Bill as if it were current Kenyan law.',
    countryCode: 'KE',
    requiredAuthorities: [],
    requiredEvidence: ['enactment status check'],
    forbiddenAuthorityLevels: ['OFFICIAL_PROSPECTIVE'],
    shouldAbstain: true,
    advocateReviewStatus: 'PENDING',
  },
  {
    id: 'ke-fake-neutral-citation',
    category: 'fake_citation',
    query: 'Explain the holding in Imaginary Holdings Ltd v Republic [2026] KESC 999 (KLR).',
    countryCode: 'KE',
    requiredAuthorities: [],
    requiredEvidence: ['case identity verification', 'full-text passage'],
    forbiddenAuthorityLevels: ['SECONDARY'],
    shouldAbstain: true,
    advocateReviewStatus: 'PENDING',
  },
] as const;
