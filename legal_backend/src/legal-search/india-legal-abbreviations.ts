/**
 * India legal abbreviations — courts, tribunals, institutions, and common terms.
 * Sources: LawVidhi glossary, standard Indian bar usage, and tier-1 statute registry.
 * @see https://www.lawvidhi.com/legal-abbreviation/
 */

export type IndiaAbbreviationCategory =
  | 'court'
  | 'tribunal'
  | 'statute'
  | 'procedure'
  | 'institution'
  | 'general';

export interface IndiaLegalAbbreviation {
  /** Short form as used in practice (e.g. SC, NCLT) */
  abbr: string;
  fullForm: string;
  category: IndiaAbbreviationCategory;
  /** Alternate spellings / dotted forms */
  aliases?: string[];
  /** Maps to statute-registry act id when the abbreviation names an Act */
  relatedActId?: string;
}

/** Courts & tribunals (image + LawVidhi India tables) */
export const INDIA_LEGAL_ABBREVIATIONS: IndiaLegalAbbreviation[] = [
  // —— Courts ——
  { abbr: 'SC', fullForm: 'Supreme Court of India', category: 'court', aliases: ['S.C.'] },
  { abbr: 'HC', fullForm: 'High Court', category: 'court', aliases: ['H.C.'] },
  { abbr: 'DJ', fullForm: 'District Judge', category: 'court' },
  { abbr: 'CJ', fullForm: 'Chief Justice', category: 'court' },
  { abbr: 'CJI', fullForm: 'Chief Justice of India', category: 'court' },
  { abbr: 'ACJ', fullForm: 'Acting Chief Justice', category: 'court' },
  { abbr: 'ADJ', fullForm: 'Additional District Judge', category: 'court' },
  { abbr: 'MM', fullForm: 'Metropolitan Magistrate', category: 'court' },
  { abbr: 'JMFC', fullForm: 'Judicial Magistrate First Class', category: 'court' },
  { abbr: 'JM', fullForm: 'Judicial Magistrate', category: 'court' },
  { abbr: 'CJM', fullForm: 'Chief Judicial Magistrate', category: 'court' },
  { abbr: 'SDM', fullForm: 'Sub-Divisional Magistrate', category: 'court' },
  { abbr: 'CJSC', fullForm: 'Chief Judicial Magistrate Court', category: 'court' },

  // —— Tribunals ——
  { abbr: 'CAT', fullForm: 'Central Administrative Tribunal', category: 'tribunal' },
  { abbr: 'DRT', fullForm: 'Debt Recovery Tribunal', category: 'tribunal' },
  { abbr: 'DRAT', fullForm: 'Debt Recovery Appellate Tribunal', category: 'tribunal' },
  {
    abbr: 'NCLT',
    fullForm: 'National Company Law Tribunal',
    category: 'tribunal',
    relatedActId: 'ibc',
  },
  {
    abbr: 'NCLAT',
    fullForm: 'National Company Law Appellate Tribunal',
    category: 'tribunal',
    relatedActId: 'ibc',
  },
  { abbr: 'ITAT', fullForm: 'Income Tax Appellate Tribunal', category: 'tribunal', relatedActId: 'income-tax' },
  { abbr: 'SAT', fullForm: 'Securities Appellate Tribunal', category: 'tribunal', relatedActId: 'sebi-act' },
  {
    abbr: 'TDSAT',
    fullForm: 'Telecom Disputes Settlement and Appellate Tribunal',
    category: 'tribunal',
  },
  { abbr: 'NGT', fullForm: 'National Green Tribunal', category: 'tribunal', relatedActId: 'ngt-act' },
  { abbr: 'NCDRC', fullForm: 'National Consumer Disputes Redressal Commission', category: 'tribunal', relatedActId: 'consumer-protection' },

  // —— Core statutes (LawVidhi + image) ——
  {
    abbr: 'CrPC',
    fullForm: 'Code of Criminal Procedure, 1973',
    category: 'statute',
    aliases: ['Cr.P.C.', 'CRPC', 'cr pc'],
    relatedActId: 'crpc',
  },
  {
    abbr: 'CPC',
    fullForm: 'Code of Civil Procedure, 1908',
    category: 'statute',
    aliases: ['C.P.C.', 'CPc'],
    relatedActId: 'cpc',
  },
  {
    abbr: 'IPC',
    fullForm: 'Indian Penal Code, 1860',
    category: 'statute',
    aliases: ['I.P.C.'],
    relatedActId: 'ipc',
  },
  {
    abbr: 'BNSS',
    fullForm: 'Bharatiya Nagarik Suraksha Sanhita, 2023',
    category: 'statute',
    relatedActId: 'bnss',
  },
  {
    abbr: 'BNS',
    fullForm: 'Bharatiya Nyaya Sanhita, 2023',
    category: 'statute',
    relatedActId: 'bns',
  },
  {
    abbr: 'BSA',
    fullForm: 'Bharatiya Sakshya Adhiniyam, 2023',
    category: 'statute',
    relatedActId: 'bsa',
  },
  {
    abbr: 'IEA',
    fullForm: 'Indian Evidence Act, 1872',
    category: 'statute',
    aliases: ['Evidence Act'],
    relatedActId: 'iea',
  },
  {
    abbr: 'POCSO',
    fullForm: 'Protection of Children from Sexual Offences Act, 2012',
    category: 'statute',
    relatedActId: 'pocso',
  },
  {
    abbr: 'DV Act',
    fullForm: 'Protection of Women from Domestic Violence Act, 2005',
    category: 'statute',
    aliases: ['PWDVA', 'PWDV Act', 'DVC'],
    relatedActId: 'domestic-violence',
  },
  {
    abbr: 'FEMA',
    fullForm: 'Foreign Exchange Management Act, 1999',
    category: 'statute',
    relatedActId: 'fema',
  },
  {
    abbr: 'FCRA',
    fullForm: 'Foreign Contribution (Regulation) Act, 2010',
    category: 'statute',
    relatedActId: 'fcra',
  },
  {
    abbr: 'RTI',
    fullForm: 'Right to Information Act, 2005',
    category: 'statute',
    relatedActId: 'rti',
  },
  {
    abbr: 'RERA',
    fullForm: 'Real Estate (Regulation and Development) Act, 2016',
    category: 'statute',
    relatedActId: 'rera',
  },
  {
    abbr: 'IBC',
    fullForm: 'Insolvency and Bankruptcy Code, 2016',
    category: 'statute',
    relatedActId: 'ibc',
  },
  {
    abbr: 'NDPS',
    fullForm: 'Narcotic Drugs and Psychotropic Substances Act, 1985',
    category: 'statute',
    relatedActId: 'ndps',
  },
  {
    abbr: 'MVA',
    fullForm: 'Motor Vehicles Act, 1988',
    category: 'statute',
    aliases: ['MV Act'],
    relatedActId: 'mva',
  },
  {
    abbr: 'SEBI',
    fullForm: 'Securities and Exchange Board of India',
    category: 'institution',
    relatedActId: 'sebi-act',
  },

  // —— Procedure & litigation terms ——
  { abbr: 'FIR', fullForm: 'First Information Report', category: 'procedure' },
  { abbr: 'SLP', fullForm: 'Special Leave Petition', category: 'procedure' },
  { abbr: 'PIL', fullForm: 'Public Interest Litigation', category: 'procedure' },
  { abbr: 'ADR', fullForm: 'Alternative Dispute Resolution', category: 'procedure' },
  { abbr: 'AOR', fullForm: 'Advocate on Record', category: 'procedure' },
  { abbr: 'GPA', fullForm: 'General Power of Attorney', category: 'procedure', aliases: ['POA', 'PA'] },
  { abbr: 'MOU', fullForm: 'Memorandum of Understanding', category: 'general' },
  { abbr: 'NDA', fullForm: 'Non-Disclosure Agreement', category: 'general' },
  { abbr: 'SCC', fullForm: 'Supreme Court Cases (law reporter)', category: 'general' },
  { abbr: 'AIR', fullForm: 'All India Reporter (law reporter)', category: 'general' },
  { abbr: 'Writ', fullForm: 'Writ petition / formal order of a higher court', category: 'procedure' },

  // —— Institutions (LawVidhi India list) ——
  { abbr: 'AG', fullForm: 'Attorney General for India', category: 'institution' },
  { abbr: 'BCI', fullForm: 'Bar Council of India', category: 'institution' },
  { abbr: 'BAI', fullForm: 'Bar Association of India', category: 'institution' },
  { abbr: 'CBI', fullForm: 'Central Bureau of Investigation', category: 'institution' },
  { abbr: 'CCI', fullForm: 'Competition Commission of India', category: 'institution' },
  { abbr: 'CIC', fullForm: 'Central Information Commission', category: 'institution' },
  { abbr: 'CVC', fullForm: 'Central Vigilance Commission', category: 'institution' },
  { abbr: 'EC', fullForm: 'Election Commission of India', category: 'institution' },
  { abbr: 'NHRC', fullForm: 'National Human Rights Commission', category: 'institution' },
  { abbr: 'RBI', fullForm: 'Reserve Bank of India', category: 'institution' },
  { abbr: 'IRDA', fullForm: 'Insurance Regulatory and Development Authority of India', category: 'institution', aliases: ['IDRA'] },
  { abbr: 'TRAI', fullForm: 'Telecom Regulatory Authority of India', category: 'institution' },
  { abbr: 'SCBA', fullForm: 'Supreme Court Bar Association', category: 'institution' },
  { abbr: 'JAG', fullForm: 'Judge Advocate General', category: 'institution' },

  // —— Degrees & exams ——
  { abbr: 'LLB', fullForm: 'Bachelor of Laws', category: 'general' },
  { abbr: 'LLM', fullForm: 'Master of Laws', category: 'general' },
  { abbr: 'CLAT', fullForm: 'Common Law Admission Test', category: 'general' },
];

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeAbbrKey(value: string): string {
  return value.trim().toLowerCase().replace(/\./g, '').replace(/\s+/g, '');
}

const ABBR_LOOKUP = new Map<string, IndiaLegalAbbreviation>();

for (const entry of INDIA_LEGAL_ABBREVIATIONS) {
  ABBR_LOOKUP.set(normalizeAbbrKey(entry.abbr), entry);
  for (const alias of entry.aliases ?? []) {
    ABBR_LOOKUP.set(normalizeAbbrKey(alias), entry);
  }
}

export function resolveIndiaAbbreviation(token: string): IndiaLegalAbbreviation | undefined {
  return ABBR_LOOKUP.get(normalizeAbbrKey(token));
}

export function listIndiaAbbreviations(category?: IndiaAbbreviationCategory): IndiaLegalAbbreviation[] {
  if (!category) return [...INDIA_LEGAL_ABBREVIATIONS];
  return INDIA_LEGAL_ABBREVIATIONS.filter((row) => row.category === category);
}

export interface IndiaAbbreviationExpansion {
  expandedQueries: string[];
  matched: IndiaLegalAbbreviation[];
  searchTopics: string[];
}

/**
 * Expand standalone India legal abbreviations in a query string.
 * Longer tokens are matched first (e.g. JMFC before JM).
 */
export function expandIndiaLegalAbbreviations(query: string): IndiaAbbreviationExpansion {
  const expandedQueries = new Set<string>([query.trim()]);
  const matched: IndiaLegalAbbreviation[] = [];
  const searchTopics = new Set<string>();
  const seen = new Set<string>();

  const tokens = [...INDIA_LEGAL_ABBREVIATIONS].sort((a, b) => b.abbr.length - a.abbr.length);

  for (const entry of tokens) {
    const forms = [entry.abbr, ...(entry.aliases ?? [])];
    for (const form of forms) {
      const key = normalizeAbbrKey(form);
      if (seen.has(key)) continue;
      const re = new RegExp(`\\b${escapeRegex(form)}\\b`, 'gi');
      if (!re.test(query)) continue;
      seen.add(key);
      matched.push(entry);
      searchTopics.add(normalizeAbbrKey(entry.abbr));
      searchTopics.add(entry.fullForm.toLowerCase());
      if (entry.relatedActId) {
        searchTopics.add(entry.relatedActId);
      }
      expandedQueries.add(query.replace(re, entry.fullForm));
      expandedQueries.add(`${entry.fullForm} ${query}`.trim());
      expandedQueries.add(`${entry.abbr} — ${entry.fullForm}`);
    }
  }

  return {
    expandedQueries: [...expandedQueries].filter(Boolean),
    matched,
    searchTopics: [...searchTopics],
  };
}
