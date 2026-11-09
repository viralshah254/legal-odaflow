/**
 * Small named-authority check pack: only what the query named (or a connector
 * hydrated with URL + quoteable text). Used as the cite-allowlist after the
 * one LLM write — not a corpus dump.
 */

import type { RetrievedAuthority } from '@/legal-search/legal-retrieval.types';
import { stripUnverifiedCitations } from '@/ai/drafting/draft-citation-sanitizer';
import {
  extractStatuteReferences,
  parseStatuteToken,
  statuteReferencesMatch,
  type StatuteReference,
} from '@/ai/citations/statute-reference';
import { extractNamedStatuteQueries } from './named-statute-extract';
import type { ResearchIntelligenceMap } from './research-intelligence-map.types';
import { isStatuteAuthority } from './similar-cases.service';

const NAMED_CASE_RE =
  /\b([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.']+){0,4}\s+v(?:s\.?|ersus)?\.?\s+[A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.']+){0,4})\b/g;

export const AUTHORITY_GAP_MARKER = '[AUTHORITY GAP: not in check pack]';

export function hasNamedStatuteCheck(query: string): boolean {
  return extractNamedStatuteQueries(query).length > 0;
}

export function extractNamedCaseTitles(text: string): string[] {
  if (!text.trim()) return [];
  const titles = new Set<string>();
  NAMED_CASE_RE.lastIndex = 0;
  for (const match of text.matchAll(NAMED_CASE_RE)) {
    const title = (match[1] ?? '').replace(/\s+/g, ' ').trim();
    if (title.length >= 8) titles.add(title);
  }
  return [...titles];
}

export function isQuoteableCaseAuthority(authority: RetrievedAuthority): boolean {
  const url = authority.sourceUrl ?? '';
  const text = (authority.fullText ?? authority.summary ?? '').trim();
  // PDF running headers and search-index labels are not case identities.
  // Keep unidentified hits as discovery leads, never cite them as judgments.
  if (authority.sourceTier === 'case_law' && !authority.citation?.trim() &&
      !/\bv\.?\s|\bvs\.?\s|\bin re\b|\bin the matter of\b/i.test(authority.title)) return false;
  return /^https?:\/\//i.test(url) && text.length >= 80;
}

export function shouldSkipInventingHops(input: {
  userRequestedDeep: boolean;
  hasNamedStatutePack: boolean;
  quotedCaseCount?: number;
}): boolean {
  if (!input.userRequestedDeep) return true;
  if (input.hasNamedStatutePack) return true;
  return (input.quotedCaseCount ?? 0) > 0;
}

export function emptyResearchIntelligenceMap(input: {
  query: string;
  countryCode: string;
  jurisdiction?: string;
}): ResearchIntelligenceMap {
  const cc = input.countryCode.toUpperCase();
  return {
    version: 1,
    modelName: 'none',
    degraded: true,
    degradationReason: 'Skipped intelligence-map LLM — named check pack / default path',
    jurisdiction: [cc, ...(input.jurisdiction ? [input.jurisdiction] : [])],
    jurisdictionConfidence: 0.4,
    issues: [{ id: 'issue-1', label: input.query.slice(0, 160), kind: 'other', priority: 1 }],
    likelyDoctrines: [],
    likelyStatutes: [],
    likelyRegulations: [],
    likelyCases: [],
    likelyProceduralRoutes: [],
    likelyRegulators: [],
    terminology: [],
    alternateTerminology: [],
    unresolvedQuestions: [],
    researchQueries: [],
    contraryAuthorityQueries: [],
    generatedAt: new Date().toISOString(),
  };
}

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function statuteKeys(query: string): string[] {
  return extractNamedStatuteQueries(query).map(normalizeKey);
}

function authorityMatchesNamedStatute(authority: RetrievedAuthority, namedKeys: string[]): boolean {
  if (namedKeys.length === 0) return false;
  const blob = normalizeKey(
    [authority.title, authority.citation, authority.section, authority.actName]
      .filter(Boolean)
      .join(' '),
  );
  return namedKeys.some((key) => {
    const tokens = key.split(' ').filter((part) => part.length > 1);
    return tokens.every((token) => blob.includes(token));
  });
}

function authorityMatchesNamedCase(authority: RetrievedAuthority, namedCases: string[]): boolean {
  if (namedCases.length === 0) return false;
  const title = normalizeKey(authority.title ?? '');
  return namedCases.some((name) => {
    const key = normalizeKey(name);
    return title.includes(key.slice(0, 24)) || key.includes(title.slice(0, 24));
  });
}

/**
 * Keep named statutes plus cases that have a source URL and quoteable text.
 * Caps the pack so the write prompt is a check list, not a library dump.
 */
export function filterAuthoritiesToCheckPack(
  authorities: RetrievedAuthority[],
  query: string,
): RetrievedAuthority[] {
  const namedStatutes = statuteKeys(query);
  const namedCases = extractNamedCaseTitles(query);
  const statutes: RetrievedAuthority[] = [];
  const cases: RetrievedAuthority[] = [];
  const seen = new Set<string>();

  for (const authority of authorities) {
    if (seen.has(authority.id)) continue;
    if (isStatuteAuthority(authority)) {
      const keep =
        namedStatutes.length === 0
          ? authority.sourceTier === 'primary' || authority.id.startsWith('section-finder-')
          : authorityMatchesNamedStatute(authority, namedStatutes) ||
            authority.id.startsWith('section-finder-');
      if (!keep) continue;
      seen.add(authority.id);
      statutes.push(authority);
      continue;
    }
    const namedHit = authorityMatchesNamedCase(authority, namedCases);
    if (namedHit || isQuoteableCaseAuthority(authority)) {
      seen.add(authority.id);
      cases.push(authority);
    }
  }

  return [...statutes.slice(0, 8), ...cases.slice(0, 5)];
}

export function packAllowsCitation(match: string, pack: RetrievedAuthority[]): boolean {
  const key = normalizeKey(match);
  for (const authority of pack) {
    const blobs = [authority.citation, authority.title, authority.summary, authority.section]
      .filter(Boolean)
      .map((part) => normalizeKey(String(part)));
    if (blobs.some((blob) => blob.includes(key) || key.includes(blob))) return true;
  }
  return false;
}

/**
 * Provisions the model is allowed to assert: whatever the user named plus
 * whatever the pack actually hydrated. Parsed jurisdiction-agnostically so US,
 * GB, KE and every other country are held to the same standard as India.
 */
function packAllowedReferences(
  pack: RetrievedAuthority[],
  query: string,
  countryCode?: string,
): StatuteReference[] {
  const allowed: StatuteReference[] = [];
  for (const named of extractNamedStatuteQueries(query)) {
    const parsed = parseStatuteToken(named, countryCode);
    if (parsed) allowed.push(parsed);
  }
  allowed.push(...extractStatuteReferences(query, countryCode));
  for (const authority of pack) {
    const blob = [authority.citation, authority.title, authority.section, authority.actName]
      .filter(Boolean)
      .join(' ');
    allowed.push(...extractStatuteReferences(blob, countryCode));
  }
  return allowed;
}

/**
 * Flag every provision the evidence pack cannot support. The reference itself is
 * kept so the reasoning stays readable - it is the unsupported *assertion* that
 * must be visible as a gap, not silently deleted.
 */
function markUnsupportedSections(
  text: string,
  allowed: StatuteReference[],
  countryCode?: string,
): { text: string; markedCount: number } {
  const found = extractStatuteReferences(text, countryCode);
  if (found.length === 0) return { text, markedCount: 0 };

  let out = text;
  let markedCount = 0;
  // Replace from the end so earlier offsets stay valid.
  for (const ref of [...found].sort((a, b) => b.start - a.start)) {
    if (allowed.some((candidate) => statuteReferencesMatch(candidate, ref))) continue;
    const trailing = out.slice(ref.end, ref.end + AUTHORITY_GAP_MARKER.length + 1);
    if (trailing.includes(AUTHORITY_GAP_MARKER)) continue;
    out = `${out.slice(0, ref.end)} ${AUTHORITY_GAP_MARKER}${out.slice(ref.end)}`;
    markedCount += 1;
  }
  return { text: out, markedCount };
}

/**
 * Deterministic post-write anti-hallucination pass: remove reporter citations the
 * pack cannot back, and mark section references it cannot back. Applies to every
 * jurisdiction.
 */
export function stripOutputToCheckPack(
  markdown: string,
  pack: RetrievedAuthority[],
  query: string,
  countryCode?: string,
): { text: string; strippedCount: number; strippedCitations: string[] } {
  const citationAuthorities = pack.map((authority) => ({
    id: authority.id,
    title: authority.title,
    citation: authority.citation,
    summary: authority.summary,
    sourceUrl: authority.sourceUrl,
  }));
  const strippedCites = stripUnverifiedCitations(markdown, citationAuthorities, [], 'strip');
  const allowed = packAllowedReferences(pack, query, countryCode);
  const marked = markUnsupportedSections(strippedCites.text, allowed, countryCode);
  return {
    text: marked.text,
    strippedCount: strippedCites.stripped.length + marked.markedCount,
    strippedCitations: strippedCites.stripped.map((s) => s.original),
  };
}
