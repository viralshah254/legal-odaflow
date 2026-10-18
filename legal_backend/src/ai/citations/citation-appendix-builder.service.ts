/**
 * CitationAppendixBuilder
 *
 * Shared service that scans drafted text for citation references, maps them to
 * verified RetrievedAuthority objects, deduplicates across sections, groups by
 * type (case law / statute), and enriches each entry with treatment status and
 * source URL. Replaces the weak regex approach in FinalAssemblyService.
 *
 * Used by both the v1 (IndiaDraftService) and v2 (FinalAssemblyService) paths
 * so exports are always consistent.
 */

import { Injectable } from '@nestjs/common';
import type { RetrievedAuthority, TreatmentStatus } from '@/legal-search/legal-retrieval.types';
import type { CitationAppendixEntry } from '@/ai/drafting-v2/drafting-v2.types';

// Extended entry with richer metadata for display and export.
export interface RichCitationAppendixEntry extends CitationAppendixEntry {
  treatmentStatus?: TreatmentStatus;
  sourceUrl?: string;
  neutralCitation?: string;
  court?: string;
  decisionYear?: number;
  /** Holding text snippet for Table of Authorities. */
  holding?: string;
}

// ─── Regex patterns ────────────────────────────────────────────────────────────

/** India law reporter patterns — used to find case cites in draft text. */
const INDIA_CASE_PATTERNS: RegExp[] = [
  /AIR\s+\d{4}\s+[A-Za-z]{1,6}\s+\d+/g,
  /\(\d{4}\)\s+\d+\s+SCC\s+\d+/g,
  /\d{4}\s+INSC\s+\d+/g,
  /\d{4}\s+SCC\s+OnLine\s+\S+\s+\d+/g,
  /\d{4}\s+CrLJ\s+\d+/g,
];

/** US reporter patterns. */
const US_CASE_PATTERNS: RegExp[] = [
  /\b\d+\s+U\.S\.\s+\d+/g,
  /\b\d+\s+F\.\s?(?:2d|3d|4th|Supp(?:\.\s?2d|\.\s?3d)?)\s+\d+/g,
  /\b\d+\s+S\.\s?Ct\.\s+\d+/g,
];

/** Statute section patterns. */
const STATUTE_PATTERNS: RegExp[] = [
  /(?:Section|§)\s*\d+[A-Za-z]?\s+(?:of\s+)?[A-Z][A-Za-z\s]{3,50}Act\b[^,\n]{0,60}/g,
  /(?:Article)\s+\d+[A-Za-z]?\s+(?:of\s+the\s+)?Constitution\b[^,\n]{0,60}/g,
  /(?:Order\s+\w+\s+Rule\s+\w+\s+(?:of\s+)?CPC)\b[^,\n]{0,60}/g,
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractCitations(text: string): { cases: string[]; statutes: string[] } {
  const cases = new Set<string>();
  const statutes = new Set<string>();

  for (const pattern of [...INDIA_CASE_PATTERNS, ...US_CASE_PATTERNS]) {
    const re = new RegExp(pattern.source, pattern.flags.replace('g', '') + 'g');
    for (const m of text.matchAll(re)) {
      const raw = m[0].trim();
      if (raw.length > 3) cases.add(raw);
    }
  }
  for (const pattern of STATUTE_PATTERNS) {
    const re = new RegExp(pattern.source, pattern.flags.replace('g', '') + 'g');
    for (const m of text.matchAll(re)) {
      const raw = m[0].trim().replace(/\s+/g, ' ');
      if (raw.length > 5) statutes.add(raw);
    }
  }

  return { cases: Array.from(cases), statutes: Array.from(statutes) };
}

function citationMatches(found: string, authority: RetrievedAuthority): boolean {
  const fl = found.toLowerCase().replace(/\s+/g, ' ');
  const cl = (authority.citation ?? '').toLowerCase().replace(/\s+/g, ' ');
  const nl = (authority.neutralCitation ?? '').toLowerCase().replace(/\s+/g, ' ');
  const tl = authority.title.toLowerCase();

  return (
    (cl && (fl.includes(cl) || cl.includes(fl))) ||
    (nl && (fl.includes(nl) || nl.includes(fl))) ||
    fl.includes(tl.substring(0, Math.min(tl.length, 20)))
  );
}

@Injectable()
export class CitationAppendixBuilderService {
  /**
   * Build a rich citation appendix from:
   * - `sections`: array of { sectionId, sectionTitle, content } objects.
   * - `authorities`: the verified RetrievedAuthority objects used during drafting.
   *
   * Returns entries grouped so case law precedes statutes, each deduped by citation.
   */
  buildFromSections(
    sections: Array<{ sectionId: string; sectionTitle: string; content: string }>,
    authorities: RetrievedAuthority[],
  ): RichCitationAppendixEntry[] {
    const caseMap = new Map<string, RichCitationAppendixEntry>();
    const statuteMap = new Map<string, RichCitationAppendixEntry>();

    for (const section of sections) {
      const { cases, statutes } = extractCitations(section.content);

      for (const found of cases) {
        if (caseMap.has(found)) continue;

        // Try to match against provided authorities.
        const authority = authorities.find((a) => citationMatches(found, a));
        const entry: RichCitationAppendixEntry = {
          sectionId: section.sectionId,
          sectionTitle: section.sectionTitle,
          paragraphIndex: 0,
          citation: authority?.citation ?? found,
          type: 'case_law',
          verified: Boolean(authority),
          treatmentStatus: authority?.treatmentStatus ?? 'good_law',
          sourceUrl: authority?.sourceUrl ?? undefined,
          neutralCitation: authority?.neutralCitation ?? undefined,
          decisionYear: authority?.decisionYear,
          holding: authority?.summary?.slice(0, 200),
        };
        caseMap.set(found, entry);
      }

      for (const found of statutes) {
        if (statuteMap.has(found)) continue;
        const entry: RichCitationAppendixEntry = {
          sectionId: section.sectionId,
          sectionTitle: section.sectionTitle,
          paragraphIndex: 0,
          citation: found,
          type: 'statute',
          verified: true,
        };
        statuteMap.set(found, entry);
      }
    }

    // Sort: good_law first, then by citation string alphabetically.
    const sortEntries = (a: RichCitationAppendixEntry, b: RichCitationAppendixEntry) => {
      const treatOrder: Record<string, number> = { good_law: 0, distinguished: 1, superseded: 2, overruled: 3, repealed: 4 };
      const ta = treatOrder[a.treatmentStatus ?? 'good_law'] ?? 5;
      const tb = treatOrder[b.treatmentStatus ?? 'good_law'] ?? 5;
      if (ta !== tb) return ta - tb;
      return a.citation.localeCompare(b.citation);
    };

    return [
      ...Array.from(caseMap.values()).sort(sortEntries),
      ...Array.from(statuteMap.values()),
    ];
  }

  /**
   * Build from a single plain-text draft (v1 engine path).
   */
  buildFromText(
    text: string,
    authorities: RetrievedAuthority[],
    fallbackSectionId = 'main',
    fallbackSectionTitle = 'Document',
  ): RichCitationAppendixEntry[] {
    return this.buildFromSections(
      [{ sectionId: fallbackSectionId, sectionTitle: fallbackSectionTitle, content: text }],
      authorities,
    );
  }

  /**
   * Render a plain-text Table of Authorities block suitable for insertion into a document.
   */
  renderTableOfAuthorities(entries: RichCitationAppendixEntry[]): string {
    if (entries.length === 0) return '';

    const cases = entries.filter((e) => e.type === 'case_law');
    const statutes = entries.filter((e) => e.type === 'statute');

    const lines: string[] = ['TABLE OF AUTHORITIES', ''];

    if (cases.length > 0) {
      lines.push('CASES');
      lines.push('─'.repeat(60));
      for (const c of cases) {
        const treatment = c.treatmentStatus && c.treatmentStatus !== 'good_law'
          ? ` [${c.treatmentStatus.replace(/_/g, ' ').toUpperCase()}]`
          : '';
        const neutral = c.neutralCitation ? ` / ${c.neutralCitation}` : '';
        lines.push(`${c.citation}${neutral}${treatment}`);
        if (c.holding) {
          lines.push(`  Holding: ${c.holding}`);
        }
        if (c.sourceUrl) {
          lines.push(`  Source: ${c.sourceUrl}`);
        }
        lines.push('');
      }
    }

    if (statutes.length > 0) {
      lines.push('STATUTES & RULES');
      lines.push('─'.repeat(60));
      for (const s of statutes) {
        lines.push(s.citation);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Render an HTML Table of Authorities for inclusion in PDF/Word exports.
   */
  renderTableOfAuthoritiesHtml(entries: RichCitationAppendixEntry[]): string {
    if (entries.length === 0) return '';

    const cases = entries.filter((e) => e.type === 'case_law');
    const statutes = entries.filter((e) => e.type === 'statute');

    const treatmentBadge = (status?: string): string => {
      if (!status || status === 'good_law') return '';
      const colours: Record<string, string> = {
        overruled: '#dc2626',
        superseded: '#d97706',
        distinguished: '#2563eb',
        repealed: '#6b7280',
      };
      const colour = colours[status] ?? '#6b7280';
      const label = status.replace(/_/g, ' ').toUpperCase();
      return ` <span style="font-size:9pt;padding:1px 4px;border-radius:3px;background:${colour};color:#fff;font-weight:600">${label}</span>`;
    };

    const parts: string[] = [
      '<div class="toa-block" style="margin-top:2em;border-top:2px solid #000;padding-top:1em">',
      '<h2 style="font-size:13pt;text-align:center;font-weight:bold;text-transform:uppercase;margin-bottom:1em">Table of Authorities</h2>',
    ];

    if (cases.length > 0) {
      parts.push('<h3 style="font-size:11pt;font-weight:bold;margin:0.8em 0 0.4em">Cases</h3>');
      parts.push('<table style="width:100%;border-collapse:collapse;font-size:10pt">');
      for (const c of cases) {
        const neutralPart = c.neutralCitation ? `<br/><span style="color:#555;font-size:9pt">${c.neutralCitation}</span>` : '';
        const holdingPart = c.holding ? `<div style="color:#444;font-size:9pt;margin-top:2px">${c.holding.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>` : '';
        const sourcePart = c.sourceUrl
          ? `<a href="${c.sourceUrl}" style="font-size:8pt;color:#2563eb">${c.sourceUrl}</a>`
          : '';
        parts.push(`<tr style="border-bottom:1px solid #eee">
<td style="padding:4px 6px;vertical-align:top">
  <strong>${c.citation.replace(/</g, '&lt;')}</strong>${treatmentBadge(c.treatmentStatus)}${neutralPart}
  ${holdingPart}
  ${sourcePart}
</td>
</tr>`);
      }
      parts.push('</table>');
    }

    if (statutes.length > 0) {
      parts.push('<h3 style="font-size:11pt;font-weight:bold;margin:0.8em 0 0.4em">Statutes &amp; Rules</h3>');
      parts.push('<ul style="font-size:10pt;margin:0;padding-left:1.5em">');
      for (const s of statutes) {
        parts.push(`<li style="margin:2px 0">${s.citation.replace(/</g, '&lt;')}</li>`);
      }
      parts.push('</ul>');
    }

    parts.push('</div>');
    return parts.join('\n');
  }
}
