/**
 * Jurisdiction-agnostic statute / section reference parsing.
 *
 * Research and drafting must answer one question identically for every country:
 * "is this section reference backed by something in the evidence pack?".
 * India-only act regexes cannot answer that for US, GB, KE or anywhere else, so
 * references are parsed structurally here and country alias overlays are applied
 * on top rather than being baked into the patterns.
 */

const SECTION_NUM = String.raw`\d+[A-Za-z]{0,2}(?:\(\d+[A-Za-z]?\))*`;

const ACT_SUFFIX = String.raw`(?:Act|Code|Sanhita|Adhiniyam|Rules|Regulations?|Ordinance|Statute|Constitution|Decree|Charter|Convention|Directive|Law)`;

/** Capitalised words followed by a statute-ish suffix, with an optional year. */
const ACT_NAME = String.raw`(?:[A-Z][A-Za-z0-9.'&-]+\s+){0,6}${ACT_SUFFIX}(?:,?\s+\d{4})?`;

/**
 * Short codes that are routinely written without a statute suffix. Kept as one
 * global list because a query rarely declares its own jurisdiction.
 */
const SHORT_CODES = [
  'BNSS',
  'BNS',
  'BSA',
  'IPC',
  'CrPC',
  'CRPC',
  'CPC',
  'IEA',
  'TPA',
  'NDPS',
  'POCSO',
  'PMLA',
  'IBC',
  'HMA',
  'RERA',
  'GST',
  'NI Act',
  'U.S.C.',
  'USC',
  'C.F.R.',
  'CFR',
  'HRA',
  'PACE',
  'CPR',
  'ECHR',
  'UCC',
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Case-insensitive spelling of a keyword. The patterns cannot use the `i` flag
 * because act names are identified by their leading capital, so keywords carry
 * their own character classes.
 */
function ci(word: string): string {
  return word
    .split('')
    .map((char) => (/[a-z]/i.test(char) ? `[${char.toLowerCase()}${char.toUpperCase()}]` : escapeRegExp(char)))
    .join('');
}

const SECTION_KEYWORDS = [
  `${ci('sections')}?`,
  `${ci('sec')}\\.?`,
  // Bare "s 6" / "ss 1" is standard in UK and Commonwealth drafting.
  `${ci('ss')}?\\.?`,
  '§§?',
  `${ci('articles')}?`,
  `${ci('arts')}?\\.`,
  `${ci('regulations')}?`,
  `${ci('regs')}?\\.`,
  `${ci('rules')}?`,
  `${ci('clauses')}?`,
].join('|');

const ARTICLE_KEYWORDS = [`${ci('articles')}?`, `${ci('arts')}?\\.`].join('|');

const SHORT_CODE_ALT = SHORT_CODES.slice()
  .sort((a, b) => b.length - a.length)
  .map((code) => escapeRegExp(code).replace(/\\\s/g, '\\s*'))
  .join('|');

export interface StatuteReference {
  /** Exact matched span - allows callers to replace it in place. */
  raw: string;
  /** Section / article number as written, e.g. "480", "115(2)", "1983". */
  section: string;
  /** Normalised act name, e.g. "bnss", "42 usc", "theft act". */
  act: string;
  /** Canonical comparison key. */
  key: string;
  start: number;
  end: number;
}

interface ActAlias {
  pattern: RegExp;
  canonical: string;
}

const GLOBAL_ACT_ALIASES: ActAlias[] = [
  { pattern: /^(?:the\s+)?constitution\b/, canonical: 'constitution' },
];

/**
 * Per-country overlays. Only aliasing lives here - the parsing itself is generic,
 * so an unlisted country still gets full reference extraction.
 */
const COUNTRY_ACT_ALIASES: Record<string, ActAlias[]> = {
  IN: [
    { pattern: /^(bnss|bharatiya nagarik suraksha sanhita)\b/, canonical: 'bnss' },
    { pattern: /^(bns|bharatiya nyaya sanhita)\b/, canonical: 'bns' },
    { pattern: /^(bsa|bharatiya sakshya adhiniyam)\b/, canonical: 'bsa' },
    { pattern: /^(crpc|cr\.?p\.?c|code of criminal procedure)\b/, canonical: 'crpc' },
    { pattern: /^(ipc|indian penal code)\b/, canonical: 'ipc' },
    { pattern: /^(cpc|code of civil procedure)\b/, canonical: 'cpc' },
    { pattern: /^(iea|indian evidence act|evidence act)\b/, canonical: 'evidence act' },
    { pattern: /^(ni act|negotiable instruments act)\b/, canonical: 'ni act' },
    { pattern: /^(tpa|transfer of property act)\b/, canonical: 'transfer of property act' },
  ],
  US: [
    { pattern: /^(\d+\s+)?u\.?s\.?c\.?$/, canonical: 'usc' },
    { pattern: /^(\d+\s+)?c\.?f\.?r\.?$/, canonical: 'cfr' },
  ],
  GB: [
    { pattern: /^(hra|human rights act)\b/, canonical: 'human rights act' },
    { pattern: /^(pace|police and criminal evidence act)\b/, canonical: 'police and criminal evidence act' },
    { pattern: /^(cpr|civil procedure rules)\b/, canonical: 'civil procedure rules' },
  ],
  KE: [
    { pattern: /^(cpc|civil procedure act)\b/, canonical: 'civil procedure act' },
    { pattern: /^(cpa|criminal procedure code)\b/, canonical: 'criminal procedure code' },
  ],
};

/** Generic suffix words that carry no discriminating power when comparing acts. */
const ACT_STOPWORDS = new Set([
  'act',
  'code',
  'the',
  'of',
  'and',
  'rules',
  'regulation',
  'regulations',
  'statute',
  'ordinance',
  'law',
  'decree',
  'no',
]);

export function normalizeSectionNumber(section: string): string {
  return section.toLowerCase().replace(/\s+/g, '');
}

export function normalizeActName(raw: string, countryCode?: string): string {
  let act = raw
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^the\s+/i, '')
    .replace(/,?\s*(?:No\.?\s*\d+\s+of\s+)?\d{4}$/i, '')
    .trim()
    .toLowerCase();

  if (!act) return '';

  const overlays = [
    ...(countryCode ? (COUNTRY_ACT_ALIASES[countryCode.toUpperCase()] ?? []) : []),
    ...Object.values(COUNTRY_ACT_ALIASES).flat(),
    ...GLOBAL_ACT_ALIASES,
  ];
  for (const { pattern, canonical } of overlays) {
    if (pattern.test(act)) {
      // Keep a US/CFR title prefix ("42 usc") so different titles stay distinct.
      const titlePrefix = /^(\d+)\s+/.exec(act)?.[1];
      act = titlePrefix ? `${titlePrefix} ${canonical}` : canonical;
      break;
    }
  }
  return act;
}

export function statuteReferenceKey(section: string, act: string): string {
  return `${normalizeSectionNumber(section)}|${act}`;
}

function actTokens(act: string): string[] {
  return act
    .split(/[^a-z0-9]+/i)
    .filter((token) => token.length > 1 && !ACT_STOPWORDS.has(token));
}

function codeTitle(act: string): string | undefined {
  return /^(\d+)\s+/.exec(act)?.[1];
}

/** Two references describe the same provision. Deliberately tolerant of naming drift. */
export function statuteReferencesMatch(a: StatuteReference, b: StatuteReference): boolean {
  if (normalizeSectionNumber(a.section) !== normalizeSectionNumber(b.section)) return false;
  if (!a.act || !b.act) return true;
  // A code title ("42 usc" vs "18 usc") is part of the provision's identity.
  const titleA = codeTitle(a.act);
  const titleB = codeTitle(b.act);
  if (titleA && titleB && titleA !== titleB) return false;
  if (a.act === b.act) return true;
  if (a.act.includes(b.act) || b.act.includes(a.act)) return true;
  const tokensA = actTokens(a.act);
  const tokensB = actTokens(b.act);
  if (tokensA.length === 0 || tokensB.length === 0) return true;
  return tokensA.some((token) => tokensB.includes(token));
}

interface PatternSpec {
  regex: RegExp;
  sectionGroup: number;
  actGroup: number;
  /** Fixed act when the pattern implies one (e.g. a bare "Article 21"). */
  impliedAct?: string;
  /** Prefix captured before the act, e.g. the US code title number. */
  titleGroup?: number;
}

function buildPatterns(): PatternSpec[] {
  return [
    // 42 U.S.C. § 1983 / 29 CFR 1910
    {
      regex: new RegExp(
        String.raw`\b(\d{1,2})\s+(U\.?\s?S\.?\s?C\.?|C\.?\s?F\.?\s?R\.?)\s*(?:§+\s*)?(${SECTION_NUM})`,
        'g',
      ),
      titleGroup: 1,
      actGroup: 2,
      sectionGroup: 3,
    },
    // Section 480 of the BNSS / Article 47 of the Constitution / s 6 of the Human Rights Act 1998
    {
      regex: new RegExp(
        String.raw`\b(?:${SECTION_KEYWORDS})\s*(${SECTION_NUM})\s+(?:${ci('of')}\s+)?(?:${ci('the')}\s+)?(${SHORT_CODE_ALT}|${ACT_NAME})`,
        'g',
      ),
      sectionGroup: 1,
      actGroup: 2,
    },
    // Theft Act 1968 s 1 / Human Rights Act, section 6
    {
      regex: new RegExp(
        String.raw`\b(${ACT_NAME})\s*,?\s*(?:§+|${ci('ss')}?\.?\s+|${ci('sections')}?\s+)(${SECTION_NUM})`,
        'g',
      ),
      actGroup: 1,
      sectionGroup: 2,
    },
    // BNSS 480 / IPC §302 / CPR 3.4
    {
      regex: new RegExp(
        String.raw`\b(${SHORT_CODE_ALT})\s*(?:§+|${ci('ss')}?\.|${ci('sections')}?)?\s*(${SECTION_NUM})\b`,
        'g',
      ),
      actGroup: 1,
      sectionGroup: 2,
    },
    // 480 BNSS
    {
      regex: new RegExp(String.raw`\b(${SECTION_NUM})\s+(${SHORT_CODE_ALT})\b`, 'g'),
      sectionGroup: 1,
      actGroup: 2,
    },
    // Bare "Article 21" - constitutions are the overwhelmingly common referent.
    {
      regex: new RegExp(String.raw`\b(?:${ARTICLE_KEYWORDS})\s*(${SECTION_NUM})\b`, 'g'),
      sectionGroup: 1,
      actGroup: -1,
      impliedAct: 'constitution',
    },
  ];
}

/**
 * Extract every statute/section reference in `text`, in document order and
 * without overlapping spans. Works for any jurisdiction.
 */
export function extractStatuteReferences(text: string, countryCode?: string): StatuteReference[] {
  if (!text || !text.trim()) return [];
  const occupied: Array<[number, number]> = [];
  const found: StatuteReference[] = [];

  const overlaps = (start: number, end: number): boolean =>
    occupied.some(([from, to]) => start < to && end > from);

  for (const spec of buildPatterns()) {
    spec.regex.lastIndex = 0;
    for (const match of text.matchAll(spec.regex)) {
      const start = match.index ?? 0;
      const end = start + match[0].length;
      if (overlaps(start, end)) continue;

      const section = (match[spec.sectionGroup] ?? '').trim();
      if (!section) continue;

      const rawAct =
        spec.actGroup > 0
          ? [spec.titleGroup ? match[spec.titleGroup] : '', match[spec.actGroup] ?? '']
              .filter(Boolean)
              .join(' ')
          : (spec.impliedAct ?? '');
      const act = normalizeActName(rawAct, countryCode);
      if (spec.actGroup > 0 && !act) continue;

      occupied.push([start, end]);
      found.push({
        raw: match[0],
        section,
        act,
        key: statuteReferenceKey(section, act),
        start,
        end,
      });
    }
  }

  return found.sort((a, b) => a.start - b.start);
}

/**
 * Parse a compact "480 BNSS" / "Article 21" token of the kind emitted by the
 * named-statute extractor, so allowlists and prose use one representation.
 */
export function parseStatuteToken(token: string, countryCode?: string): StatuteReference | null {
  const trimmed = token.trim();
  if (!trimmed) return null;

  const articleMatch = new RegExp(String.raw`^articles?\s+(${SECTION_NUM})$`, 'i').exec(trimmed);
  if (articleMatch) {
    const section = articleMatch[1];
    const act = 'constitution';
    return { raw: trimmed, section, act, key: statuteReferenceKey(section, act), start: 0, end: trimmed.length };
  }

  const numberFirst = new RegExp(String.raw`^(${SECTION_NUM})\s+(.+)$`, 'i').exec(trimmed);
  if (numberFirst) {
    const section = numberFirst[1];
    const act = normalizeActName(numberFirst[2] ?? '', countryCode);
    if (act) {
      return { raw: trimmed, section, act, key: statuteReferenceKey(section, act), start: 0, end: trimmed.length };
    }
  }

  return extractStatuteReferences(trimmed, countryCode)[0] ?? null;
}
