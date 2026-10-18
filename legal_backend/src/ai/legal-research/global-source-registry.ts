/**
 * Configurable global source registry for jurisdiction-aware research routing.
 * Corpus is one source; live/official sources are mandatory for Legal Research.
 */

export type SourceTier = 'primary' | 'reliable_db' | 'discovery';

export interface JurisdictionSourceEntry {
  id: string;
  label: string;
  tier: SourceTier;
  kind: 'legislation' | 'court' | 'regulator' | 'gazette' | 'database' | 'secondary';
  /** Connector / provider key used by the retrieval orchestrator. */
  provider?: string;
  domains?: string[];
}

export interface JurisdictionSourceProfile {
  jurisdiction: string;
  courts: JurisdictionSourceEntry[];
  legislation: JurisdictionSourceEntry[];
  regulators: JurisdictionSourceEntry[];
  secondary: JurisdictionSourceEntry[];
  citationFormats: string[];
  courtHierarchy: string[];
}

const IN_PROFILE: JurisdictionSourceProfile = {
  jurisdiction: 'IN',
  legislation: [
    {
      id: 'india-code',
      label: 'India Code / Gazette of India',
      tier: 'primary',
      kind: 'legislation',
      provider: 'india-code',
      domains: ['indiacode.nic.in', 'egazette.gov.in'],
    },
  ],
  courts: [
    {
      id: 'escr',
      label: 'Supreme Court e-SCR',
      tier: 'primary',
      kind: 'court',
      provider: 'escr',
      domains: ['sci.gov.in'],
    },
    {
      id: 'india-kanoon',
      label: 'Indian Kanoon (discovery → verify)',
      tier: 'discovery',
      kind: 'database',
      provider: 'india-kanoon',
      domains: ['indiankanoon.org'],
    },
  ],
  regulators: [
    {
      id: 'rbi',
      label: 'Reserve Bank of India',
      tier: 'primary',
      kind: 'regulator',
      provider: 'rbi',
      domains: ['rbi.org.in'],
    },
    {
      id: 'cibil',
      label: 'Credit Information Companies / CIBIL dispute channels',
      tier: 'primary',
      kind: 'regulator',
      domains: ['cibil.com', 'transunioncibil.com'],
    },
  ],
  secondary: [
    {
      id: 'tavily-legal',
      label: 'Tavily legal web discovery',
      tier: 'discovery',
      kind: 'secondary',
      provider: 'tavily',
    },
  ],
  citationFormats: [
    'Case Name v Case Name, (Year) Volume SCC Page',
    'Act Name, Year, s.__',
  ],
  courtHierarchy: [
    'Supreme Court of India',
    'High Court',
    'District & Sessions',
    'Magistrate / tribunals',
  ],
};

const US_FEDERAL: JurisdictionSourceProfile = {
  jurisdiction: 'US-FEDERAL',
  legislation: [
    {
      id: 'uscode',
      label: 'US Code / Congress.gov',
      tier: 'primary',
      kind: 'legislation',
      domains: ['congress.gov', 'uscode.house.gov'],
    },
  ],
  courts: [
    {
      id: 'courtlistener',
      label: 'CourtListener / RECAP',
      tier: 'reliable_db',
      kind: 'database',
      provider: 'courtlistener',
      domains: ['courtlistener.com'],
    },
  ],
  regulators: [
    {
      id: 'federal-agencies',
      label: 'Federal agencies (CFR / agency sites)',
      tier: 'primary',
      kind: 'regulator',
      domains: ['ecfr.gov'],
    },
  ],
  secondary: [
    {
      id: 'tavily-legal',
      label: 'Tavily legal web discovery',
      tier: 'discovery',
      kind: 'secondary',
      provider: 'tavily',
    },
  ],
  citationFormats: ['Case Name v. Case Name, Volume Reporter Page (Court Year)'],
  courtHierarchy: ['US Supreme Court', 'Circuit Courts', 'District Courts'],
};

const KE_PROFILE: JurisdictionSourceProfile = {
  jurisdiction: 'KE',
  legislation: [
    {
      id: 'kenya-law-acts',
      label: 'Kenya Law Acts',
      tier: 'primary',
      kind: 'legislation',
      provider: 'kenya-law',
      domains: ['new.kenyalaw.org', 'kenyalaw.org'],
    },
  ],
  courts: [
    {
      id: 'kenya-law-cases',
      label: 'Kenya Law judgments',
      tier: 'primary',
      kind: 'court',
      provider: 'kenya-law',
      domains: ['new.kenyalaw.org'],
    },
  ],
  regulators: [],
  secondary: [
    {
      id: 'tavily-legal',
      label: 'Tavily legal web discovery',
      tier: 'discovery',
      kind: 'secondary',
      provider: 'tavily',
    },
  ],
  citationFormats: ['Case Name v Case Name [Year] eKLR'],
  courtHierarchy: ['Supreme Court', 'Court of Appeal', 'High Court', 'Magistrates'],
};

const GB_PROFILE: JurisdictionSourceProfile = {
  jurisdiction: 'GB',
  legislation: [
    {
      id: 'legislation-gov-uk',
      label: 'legislation.gov.uk',
      tier: 'primary',
      kind: 'legislation',
      provider: 'uk-legislation',
      domains: ['legislation.gov.uk'],
    },
  ],
  courts: [
    {
      id: 'bailii',
      label: 'BAILII / National Archives',
      tier: 'reliable_db',
      kind: 'database',
      domains: ['bailii.org', 'caselaw.nationalarchives.gov.uk'],
    },
  ],
  regulators: [],
  secondary: [
    {
      id: 'tavily-legal',
      label: 'Tavily legal web discovery',
      tier: 'discovery',
      kind: 'secondary',
      provider: 'tavily',
    },
  ],
  citationFormats: ['Case Name v Case Name [Year] UKSC __'],
  courtHierarchy: ['UKSC', 'Court of Appeal', 'High Court', 'County Court'],
};

const REGISTRY: Record<string, JurisdictionSourceProfile> = {
  IN: IN_PROFILE,
  'US-FEDERAL': US_FEDERAL,
  US: US_FEDERAL,
  KE: KE_PROFILE,
  GB: GB_PROFILE,
  UK: GB_PROFILE,
};

/** Resolve profile; unknown jurisdictions get a best-effort discovery-first profile. */
export function getJurisdictionSourceProfile(
  countryCode: string,
): JurisdictionSourceProfile {
  const key = countryCode.toUpperCase();
  if (REGISTRY[key]) return REGISTRY[key];
  return {
    jurisdiction: key,
    legislation: [],
    courts: [],
    regulators: [],
    secondary: [
      {
        id: 'tavily-legal',
        label: 'Tavily legal web discovery',
        tier: 'discovery',
        kind: 'secondary',
        provider: 'tavily',
      },
    ],
    citationFormats: ['Use local official citation practice'],
    courtHierarchy: ['Apex court', 'Appellate', 'Trial'],
  };
}

export function listProvidersInPriorityOrder(
  countryCode: string,
): JurisdictionSourceEntry[] {
  const profile = getJurisdictionSourceProfile(countryCode);
  const ordered = [
    ...profile.legislation,
    ...profile.courts,
    ...profile.regulators,
    ...profile.secondary,
  ];
  const tierRank = (t: SourceTier) =>
    t === 'primary' ? 0 : t === 'reliable_db' ? 1 : 2;
  return ordered.sort((a, b) => tierRank(a.tier) - tierRank(b.tier));
}

export function buildSourceRegistryPromptBlock(countryCode: string): string {
  const profile = getJurisdictionSourceProfile(countryCode);
  return [
    `## Jurisdiction source registry (${profile.jurisdiction})`,
    'Priority: Tier-1 primary (official) → Tier-2 reliable databases → Tier-3 discovery.',
    'Discovery sources may suggest authorities; retrieve primary text before relying.',
    `Legislation: ${profile.legislation.map((e) => e.label).join('; ') || 'best-effort web'}`,
    `Courts: ${profile.courts.map((e) => e.label).join('; ') || 'best-effort web'}`,
    `Regulators: ${profile.regulators.map((e) => e.label).join('; ') || 'n/a'}`,
    `Court hierarchy: ${profile.courtHierarchy.join(' > ')}`,
  ].join('\n');
}
