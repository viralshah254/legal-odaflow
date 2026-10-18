import { expandIndiaLegalAbbreviations } from '../india-legal-abbreviations';
import { IN_SECTION_REMAPS } from './section-remap.in';
import { IN_STATUTES } from './in.statutes';
import { US_STATUTES } from './us.statutes';
import { US_STATE_STATUTES } from './us.states.statutes';
import { US_STATE_STATUTES_EXPANDED } from './us.states.expanded';
import { US_FEDERAL_BULK_STATUTES } from './us.statutes.federal-bulk';
import { KE_STATUTES } from './ke.statutes';
import { GB_STATUTES } from './gb.statutes';
import type {
  ParsedStatuteQuery,
  QueryExpansionResult,
  SectionRemapEntry,
  StatuteEntry,
} from './types';

export const TIER1_COUNTRY_CODES = ['IN', 'US', 'KE', 'GB'] as const;

export const ALL_STATUTES: StatuteEntry[] = [
  ...IN_STATUTES,
  ...US_STATUTES,
  ...US_FEDERAL_BULK_STATUTES,
  ...US_STATE_STATUTES,
  ...US_STATE_STATUTES_EXPANDED,
  ...KE_STATUTES,
  ...GB_STATUTES,
];

// Alternatives (capture groups):
//  1: section from "section 101 [bnss]"     2: act from same
//  3: act   from "bnss section 101"          4: section from same
//  5: act   from "bnss 101"                  6: section from same
//  7: section from "101 bnss" (reverse)      8: act from same
const SECTION_QUERY =
  /\b(?:s\.?|sec\.?|section|§|art\.?|article|rule)\s*(\d+[A-Za-z]?)\b(?:\s+(?:of\s+)?([a-z0-9][\w\s.-]{0,80}))?|\b([a-z0-9][\w.-]{1,20})\s+(?:s\.?|sec\.?|section|§|art\.?|article|rule)\s*(\d+[A-Za-z]?)\b|\b([a-z][\w-]{1,30})\s+(\d+[A-Za-z]?)\b|\b(\d+[A-Za-z]?)\s+([a-z][\w-]{1,30})\b/gi;

const MAX_EXPANDED_QUERIES = 8;

function normalizeToken(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeActKey(value: string): string {
  return normalizeToken(value).replace(/[^a-z0-9]/g, '');
}

function buildAcronymIndex(): Map<string, StatuteEntry> {
  const index = new Map<string, StatuteEntry>();
  for (const statute of ALL_STATUTES) {
    index.set(normalizeActKey(statute.id), statute);
    for (const acronym of statute.acronyms) {
      index.set(normalizeActKey(acronym), statute);
    }
    for (const alias of statute.searchAliases) {
      index.set(normalizeActKey(alias), statute);
    }
    index.set(normalizeActKey(statute.shortName), statute);
  }
  return index;
}

const ACRONYM_INDEX = buildAcronymIndex();

function getSectionRemaps(countryCode: string): SectionRemapEntry[] {
  if (countryCode.toUpperCase() === 'IN') {
    return IN_SECTION_REMAPS;
  }
  return [];
}

export function getStatutesForCountry(countryCode: string): StatuteEntry[] {
  const code = countryCode.toUpperCase();
  return ALL_STATUTES.filter((s) => s.countryCode === code);
}

export function findStatuteById(actId: string): StatuteEntry | undefined {
  return ALL_STATUTES.find((s) => s.id === actId);
}

/** Resolve a manifest actId or registry id to a statute entry (India-first). */
export function findStatuteByManifestActId(
  manifestOrRegistryActId: string,
  countryCode = 'IN',
): StatuteEntry | undefined {
  const code = countryCode.toUpperCase();
  const direct = findStatuteById(manifestOrRegistryActId);
  if (direct?.countryCode === code) return direct;

  return ALL_STATUTES.find(
    (s) =>
      s.countryCode === code &&
      (s.externalId === `manifest/${manifestOrRegistryActId}` ||
        s.id === manifestOrRegistryActId),
  );
}

/** Map manifest actId to canonical registry id for ingest/storage. */
export function resolveIngestActId(
  manifestOrRegistryActId: string,
  countryCode = 'IN',
): string | undefined {
  return findStatuteByManifestActId(manifestOrRegistryActId, countryCode)?.id;
}

export function resolveAcronym(token: string, countryCode?: string): StatuteEntry | undefined {
  const key = normalizeActKey(token);
  const statute = ACRONYM_INDEX.get(key);
  if (!statute) return undefined;
  if (countryCode && statute.countryCode !== countryCode.toUpperCase()) {
    return undefined;
  }
  return statute;
}

export function getSearchTopicsForStatute(statute: StatuteEntry): string[] {
  const topics = new Set<string>([
    statute.id,
    ...statute.acronyms.map((a) => normalizeActKey(a)),
    ...statute.searchAliases.map((a) => normalizeToken(a)),
    normalizeToken(statute.fullName),
    normalizeToken(statute.shortName),
  ]);
  return [...topics].filter(Boolean);
}

export function findRemap(
  countryCode: string,
  actId: string,
  section: string,
): SectionRemapEntry | undefined {
  const normalizedSection = section.replace(/^0+/, '').toUpperCase();
  return getSectionRemaps(countryCode).find(
    (row) =>
      row.from.actId === actId &&
      row.from.section.replace(/^0+/, '').toUpperCase() === normalizedSection,
  );
}

/**
 * Insert spaces between a digit run and 2+ adjacent letters (and vice versa),
 * so inputs like "420ipc", "ipc420", "section498a" are parsed correctly.
 * Single trailing letters are preserved as section suffixes (e.g. "124A", "65B", "498A").
 */
function normalizeQuerySpacing(q: string): string {
  return q
    .replace(/(\d+)([a-zA-Z]{2,})/g, '$1 $2')
    .replace(/([a-zA-Z]{2,})(\d+)/g, '$1 $2');
}

export function parseStatuteQuery(query: string, countryCode = 'IN'): ParsedStatuteQuery {
  const trimmed = normalizeQuerySpacing(query.trim());
  let section: string | undefined;
  let actToken: string | undefined;
  let actId: string | undefined;
  let statute: StatuteEntry | undefined;
  let isBareActQuery = false;

  for (const match of trimmed.matchAll(SECTION_QUERY)) {
    const candidateSection = match[1] ?? match[4] ?? match[6];
    const candidateAct = match[2] ?? match[3] ?? match[5];
    // Reverse pattern "101 bnss": groups 7 (section) and 8 (act).
    // Only accept when the act token resolves to a known statute to avoid
    // false matches like "within 30 days".
    const reverseSection = match[7];
    const reverseAct = match[8];

    if (candidateSection ?? candidateAct) {
      isBareActQuery = true;
      section = candidateSection;
      actToken = candidateAct;
      break;
    }

    if (reverseSection && reverseAct && resolveAcronym(reverseAct, countryCode)) {
      isBareActQuery = true;
      section = reverseSection;
      actToken = reverseAct;
      break;
    }
  }

  const lower = trimmed.toLowerCase();
  if (!statute) {
    // Prefer longer acronym matches first (e.g. "land act" over a shorter false hit).
    let bestLen = 0;
    for (const entry of getStatutesForCountry(countryCode)) {
      for (const acronym of [entry.id, ...entry.acronyms, entry.shortName]) {
        const re = new RegExp(`\\b${acronym.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (re.test(lower) && acronym.length >= bestLen) {
          statute = entry;
          actId = entry.id;
          actToken = actToken ?? acronym;
          isBareActQuery = true;
          bestLen = acronym.length;
        }
      }
    }
  }

  if (actToken && !statute) {
    statute = resolveAcronym(actToken, countryCode);
    actId = statute?.id;
    if (statute) isBareActQuery = true;
  }

  // Single-token capture often grabs only "Act" from "Land Act s.179".
  // Resolve a longer left-hand phrase before the section marker.
  if (section && !statute) {
    const phraseStatute = resolveActPhraseBeforeSection(trimmed, countryCode);
    if (phraseStatute) {
      statute = phraseStatute;
      actId = phraseStatute.id;
      actToken = phraseStatute.shortName;
      isBareActQuery = true;
    }
  }

  if (statute && !actId) {
    actId = statute.id;
  }

  if (section || statute) {
    isBareActQuery = true;
  }

  return { section, actToken, actId, statute, isBareActQuery };
}

/**
 * Resolve multi-word act names that sit immediately before a section marker
 * (e.g. "Land Act" in "Land Act s.179") when the single-token act capture failed.
 */
function resolveActPhraseBeforeSection(
  trimmed: string,
  countryCode: string,
): StatuteEntry | undefined {
  const marker = trimmed.match(
    /^(.+?)\s+(?:s\.?|sec\.?|section|§|art\.?|article|rule)\s*\d+[A-Za-z]?\b/i,
  );
  if (!marker?.[1]) return undefined;

  const words = marker[1].trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return undefined;

  // Try longest phrase first, then drop leading words ("The Land Act" → "Land Act").
  for (let start = 0; start < words.length; start++) {
    const candidate = words.slice(start).join(' ');
    const resolved = resolveAcronym(candidate, countryCode);
    if (resolved) return resolved;
  }
  return undefined;
}

function buildQueryVariants(
  query: string,
  statute: StatuteEntry,
  section?: string,
): string[] {
  const variants = new Set<string>();
  const names = [statute.fullName, statute.shortName, ...statute.searchAliases, ...statute.acronyms];

  for (const name of names) {
    if (section) {
      variants.add(`section ${section} ${name}`);
      variants.add(`${name} section ${section}`);
      variants.add(`${statute.shortName} s.${section}`);
      variants.add(`Section ${section} ${statute.countryCode}`);
    } else {
      variants.add(`${name} ${query}`.replace(/\s+/g, ' ').trim());
      variants.add(name);
    }
  }

  if (statute.predecessorActId) {
    const predecessor = findStatuteById(statute.predecessorActId);
    if (predecessor && section) {
      variants.add(`section ${section} ${predecessor.fullName}`);
    }
  }

  return [...variants].filter(Boolean);
}

export function expandQuery(query: string, countryCode = 'IN'): QueryExpansionResult {
  const trimmed = query.trim();
  const code = countryCode.toUpperCase();
  const expanded = new Set<string>([trimmed]);
  const searchTopics = new Set<string>();
  const parsed = parseStatuteQuery(trimmed, code);
  let isBareActQuery = parsed.isBareActQuery;
  let remappedSection: QueryExpansionResult['remappedSection'];

  if (parsed.statute) {
    for (const topic of getSearchTopicsForStatute(parsed.statute)) {
      searchTopics.add(topic);
    }
    for (const variant of buildQueryVariants(trimmed, parsed.statute, parsed.section)) {
      expanded.add(variant);
    }
  }

  const lower = trimmed.toLowerCase();
  for (const statute of getStatutesForCountry(code)) {
    for (const acronym of statute.acronyms) {
      const re = new RegExp(`\\b${acronym.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (!re.test(lower)) continue;
      isBareActQuery = true;
      for (const topic of getSearchTopicsForStatute(statute)) {
        searchTopics.add(topic);
      }
      for (const variant of buildQueryVariants(trimmed.replace(re, statute.fullName), statute, parsed.section)) {
        expanded.add(variant);
      }
      expanded.add(trimmed.replace(re, statute.fullName));
    }
  }

  if (parsed.section && parsed.actId) {
    const remap = findRemap(code, parsed.actId, parsed.section);
    if (remap) {
      const target = findStatuteById(remap.to.actId);
      if (target) {
        remappedSection = {
          actId: remap.to.actId,
          section: remap.to.section,
          note: remap.note,
        };
        for (const variant of buildQueryVariants(trimmed, target, remap.to.section)) {
          expanded.add(variant);
        }
        expanded.add(
          `${target.shortName} s.${remap.to.section} (formerly ${parsed.actId.toUpperCase()} s.${parsed.section})`,
        );
      }
    }
  }

  if (parsed.section && !parsed.statute) {
    expanded.add(`Section ${parsed.section} ${code}`);
    isBareActQuery = true;
  }

  if (code === 'IN') {
    const abbrExpansion = expandIndiaLegalAbbreviations(trimmed);
    for (const variant of abbrExpansion.expandedQueries) {
      expanded.add(variant);
    }
    for (const topic of abbrExpansion.searchTopics) {
      searchTopics.add(topic);
    }
    for (const match of abbrExpansion.matched) {
      if (match.relatedActId) {
        const linked = findStatuteById(match.relatedActId);
        if (linked) {
          for (const topic of getSearchTopicsForStatute(linked)) {
            searchTopics.add(topic);
          }
          for (const variant of buildQueryVariants(trimmed, linked, parsed.section)) {
            expanded.add(variant);
          }
        }
      }
    }
  }

  const expandedQueries = [...expanded]
    .filter(Boolean)
    .slice(0, MAX_EXPANDED_QUERIES);

  return {
    expandedQueries: expandedQueries.length > 0 ? expandedQueries : [trimmed],
    isBareActQuery,
    parsed,
    remappedSection,
    searchTopics: [...searchTopics],
  };
}

export function formatSectionCitation(statute: StatuteEntry, section: string): string {
  return `${statute.shortName} s.${section}`;
}

export interface RequestedSectionGap {
  missing: boolean;
  actId?: string;
  section?: string;
  statuteShortName?: string;
}

function normalizeSectionNumber(section: string): string {
  return section.replace(/^0+/, '').toUpperCase();
}

function authorityMentionsSection(
  authority: {
    title?: string | null;
    citation?: string | null;
    fullText?: string | null;
    summary?: string | null;
  },
  statute: StatuteEntry,
  section: string,
): boolean {
  const normalizedSection = normalizeSectionNumber(section);
  const blob = [authority.title, authority.citation, authority.fullText, authority.summary]
    .filter(Boolean)
    .join(' ');

  const patterns = [
    new RegExp(`\\b${statute.shortName}\\s*s\\.?\\s*${normalizedSection}\\b`, 'i'),
    new RegExp(`\\b${statute.shortName}\\s*section\\s+${normalizedSection}\\b`, 'i'),
    ...statute.acronyms.map(
      (acronym) =>
        new RegExp(
          `\\b${acronym.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*(?:s\\.?|section)\\s*${normalizedSection}\\b`,
          'i',
        ),
    ),
    new RegExp(`\\bsection\\s+${normalizedSection}\\b.*\\b${statute.shortName}\\b`, 'i'),
    new RegExp(`\\bsection\\s+${normalizedSection}\\b`, 'i'),
  ];

  return patterns.some((pattern) => pattern.test(blob));
}

/** True when the query names a specific statute section that none of the authorities cover. */
export function requestedSectionMissingFromAuthorities(
  query: string,
  countryCode: string,
  authorities: Array<{
    title?: string | null;
    citation?: string | null;
    fullText?: string | null;
    summary?: string | null;
  }>,
): RequestedSectionGap {
  const parsed = parseStatuteQuery(query, countryCode);
  if (!parsed.section || !parsed.statute) {
    return { missing: false };
  }

  const found = authorities.some((authority) =>
    authorityMentionsSection(authority, parsed.statute!, parsed.section!),
  );

  return {
    missing: !found,
    actId: parsed.actId,
    section: parsed.section,
    statuteShortName: parsed.statute.shortName,
  };
}

export function getIngestPriorityStatutes(countryCode: string, maxPriority = 2): StatuteEntry[] {
  return getStatutesForCountry(countryCode)
    .filter((s) => (s.ingestPriority ?? 99) <= maxPriority)
    .sort((a, b) => (a.ingestPriority ?? 99) - (b.ingestPriority ?? 99));
}

/**
 * Reverse remap: given a target act + section (e.g. bnss / 101), returns the
 * legacy predecessor entry (e.g. crpc / 98) if one exists in the remap table.
 * Used to inject authoritative predecessor facts into the LLM grounding prompt.
 */
export function findPredecessorSection(
  countryCode: string,
  targetActId: string,
  targetSection: string,
): SectionRemapEntry | undefined {
  const normalizedSection = targetSection.replace(/^0+/, '').toUpperCase();
  return getSectionRemaps(countryCode).find(
    (row) =>
      row.to.actId === targetActId &&
      row.to.section.replace(/^0+/, '').toUpperCase() === normalizedSection,
  );
}

export type { StatuteEntry, QueryExpansionResult, ParsedStatuteQuery, SectionRemapEntry };
