import type { CitationAuthority } from '@/ai/citations/citation-verification.service';
import { UNVERIFIED_AUTHORITY_DISCLAIMER } from './legal-accuracy-protocol';
import type { StrippedCitation } from './draft-verification.types';

/**
 * Citation-like patterns — aligned with citation-verification.service.ts.
 *
 * Coverage is deliberately multi-jurisdiction: an unverifiable citation must be
 * caught in a US, UK, Kenyan, Canadian, Australian or Nigerian draft exactly as
 * it is in an Indian one, otherwise non-India work gets weaker protection.
 */
export const DRAFT_CITATION_PATTERNS: RegExp[] = [
  // India
  /AIR\s+\d{4}\s+[A-Za-z]+\s+\d+/gi,
  /\(\d{4}\)\s+\d+\s+SCC\s+\d+/gi,
  /\b\d+\s+Cr\.?\s*L\.?\s*J\.?\s+\d+/gi,
  // United States
  /\b\d+\s+U\.S\.\s+\d+/gi,
  /\b\d+\s+F\.\s?(?:2d|3d|4th)\s+\d+/gi,
  /\b\d+\s+S\.\s?Ct\.\s+\d+/gi,
  // Kenya
  /\[\d{4}\]\s+e?KLR/gi,
  // Canada
  /\b\d{4}\s+SCC\s+\d+/gi,
  /\[\d{4}\]\s+\d*\s?S\.?C\.?R\.?\s+\d+/gi,
  // Australia
  /\(\d{4}\)\s+\d+\s+CLR\s+\d+/gi,
  // Nigeria
  /\(\d{4}\)\s+\d+\s+NWLR\s*\(Pt\.?\s*\d+\)\s*\d+/gi,
  // Neutral citations: UKSC/UKHL/EWCA/EWHC, KESC/KECA/KEHC, HCA/FCA, SGCA, ZACC, NZSC ...
  /\[\d{4}\]\s+[A-Z]{2,6}\s+(?:Civ|Crim|Admin|Ch|QB|KB|Fam|Pat|TCC|Comm)?\s*\d+/g,
];

function normalizeCite(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

function isCitationBacked(match: string, authorities: CitationAuthority[]): boolean {
  const normalized = normalizeCite(match);
  for (const auth of authorities) {
    const blobs = [auth.citation, auth.title, auth.summary]
      .filter(Boolean)
      .map((b) => normalizeCite(String(b)));
    for (const blob of blobs) {
      if (blob.includes(normalized) || normalized.includes(blob)) {
        return true;
      }
    }
  }
  return false;
}

export interface StripUnverifiedCitationsResult {
  text: string;
  stripped: StrippedCitation[];
}

export type UnverifiedCitationMode = 'strip' | 'mark';

/**
 * Handle citation-like spans not backed by retrieved authorities.
 * Default `mark` keeps the citation and appends an unverified marker (generate→verify).
 * `strip` replaces the span with the disclaimer (legacy / fail-closed export).
 */
export function stripUnverifiedCitations(
  text: string,
  authorities: CitationAuthority[],
  extraVerified: string[] = [],
  mode: UnverifiedCitationMode = 'mark',
): StripUnverifiedCitationsResult {
  const stripped: StrippedCitation[] = [];
  const known = [
    ...authorities.map((a) => a.citation ?? '').filter(Boolean),
    ...authorities.map((a) => a.title).filter(Boolean),
    ...extraVerified,
  ];

  let out = text;
  const seen = new Set<string>();

  for (const pattern of DRAFT_CITATION_PATTERNS) {
    pattern.lastIndex = 0;
    for (const m of out.matchAll(pattern)) {
      const match = m[0].trim();
      if (seen.has(match)) continue;
      seen.add(match);

      if (isCitationBacked(match, authorities)) continue;
      if (known.some((k) => normalizeCite(k).includes(normalizeCite(match)))) continue;

      stripped.push({
        original: match,
        reason: 'Citation not backed by retrieved corpus authority',
      });
      if (mode === 'strip') {
        out = out.split(match).join(`[${UNVERIFIED_AUTHORITY_DISCLAIMER}]`);
      } else if (!out.includes(`${match} [${UNVERIFIED_AUTHORITY_DISCLAIMER}]`)) {
        out = out.split(match).join(`${match} [${UNVERIFIED_AUTHORITY_DISCLAIMER}]`);
      }
    }
  }

  return { text: out, stripped };
}

/** @deprecated Prefer stripUnverifiedCitations(..., 'mark') — alias for clarity. */
export function markUnverifiedCitations(
  text: string,
  authorities: CitationAuthority[],
  extraVerified: string[] = [],
): StripUnverifiedCitationsResult {
  return stripUnverifiedCitations(text, authorities, extraVerified, 'mark');
}

/**
 * Remove inline occurrences of UNVERIFIED_AUTHORITY_DISCLAIMER that appear
 * immediately after a case name present in the provided grounding authorities.
 *
 * The LLM sometimes adds the disclaimer after citations even when they come
 * from the VERIFIED AUTHORITIES prompt block. This function removes those
 * false-positive disclaimers as a post-processing safety net.
 *
 * Matching is line-aware: the disclaimer must appear on the line(s) immediately
 * following the case name mention (within 2 lines) to be considered adjacent.
 */
export function stripGroundingAuthorityDisclaimers(
  text: string,
  groundingAuthorities: { title: string; citation?: string | null }[],
): string {
  if (!groundingAuthorities.length) return text;

  const escapedDisclaimer = UNVERIFIED_AUTHORITY_DISCLAIMER.replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&',
  );

  let out = text;

  for (const auth of groundingAuthorities) {
    const titleNorm = auth.title.trim();
    if (!titleNorm) continue;

    const escapedTitle = titleNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Match: case name on a line, then within the next 1-2 lines the disclaimer
    // appears (possibly bracketed). Remove only the disclaimer line/span.
    const pattern = new RegExp(
      `(${escapedTitle}[^\\n]*)\\n([ \\t]*\\[?${escapedDisclaimer}\\]?[ \\t]*\\n?)`,
      'gi',
    );
    out = out.replace(pattern, '$1\n');
  }

  return out;
}
