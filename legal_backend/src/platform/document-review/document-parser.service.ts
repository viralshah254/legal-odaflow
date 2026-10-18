/**
 * TODO-069 — Document Structure Parser
 *
 * Parses raw legal document text into a structured representation:
 * sections, defined terms, parties, effective dates.
 */

import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type {
  DocumentStructure,
  DocumentSection,
  DefinedTerm,
  DocumentParty,
} from './document-review.types';

// Patterns for detecting section headings
const NUMBERED_HEADING = /^(\d+(?:\.\d+)*)\s+([A-Z][^\n]{2,80})/;
const LETTERED_HEADING = /^([A-Z])\.\s+([A-Z][^\n]{2,80})/;
const BOLD_ALL_CAPS_HEADING = /^([A-Z][A-Z\s]{4,60})$/;
const ROMAN_HEADING = /^((?:X{0,3})(?:IX|IV|V?I{0,3}))\.\s+([A-Z][^\n]{2,80})/i;

// Patterns for defined terms
const DEFINED_TERM_PATTERNS = [
  // "Term" means ...
  /[""]([^""]{1,80})[""][,\s]+(?:shall\s+)?(?:mean|means|refer(?:s)?\s+to|has\s+the\s+meaning)/gi,
  // Term (as defined in ...)
  /\([""]([^""]{1,80})[""]\)/g,
  // "Term" shall have the meaning
  /[""]([^""]{1,80})[""]\s+shall\s+have\s+the\s+meaning/gi,
  // X is defined as
  /\b([A-Z][a-zA-Z\s]{1,40})\s+(?:is|are)\s+(?:hereby\s+)?defined\s+as/g,
];

// Party identification from recital / preamble
const PARTY_PATTERNS = [
  /\(hereinafter(?:\s+referred\s+to)?\s+as\s+[""]([^""]{1,60})[""]\)/gi,
  /\([""]([^""]{1,60})[""]\s*(?:,\s*the\s+[""][^""]+[""]\s*)?\)/g,
  /between\s+([A-Z][^,\n]{3,80}),?\s+(?:a|an|the|incorporated)/gi,
  /(?:BETWEEN|AMONG)\s*:\s*\n?\s*1\.\s*([^\n,;]{5,80})/gi,
];

const EFFECTIVE_DATE_PATTERNS = [
  /effective\s+(?:date|as\s+of)[:\s]+([^\n,;.]{5,50})/gi,
  /dated?(?:\s+as\s+of)?\s+(?:the\s+)?(\d{1,2}(?:st|nd|rd|th)?\s+(?:day\s+of\s+)?[A-Za-z]+,?\s+\d{4})/gi,
  /this\s+agreement\s+is\s+entered?\s+into\s+(?:as\s+of\s+)?([^\n,;.]{5,50})/gi,
];

@Injectable()
export class DocumentParserService {
  // ─── Public API ───────────────────────────────────────────────────────────

  parseDocument(rawText: string): DocumentStructure {
    const lines = rawText.split('\n');
    const sections = this.extractSections(lines, rawText);
    const definedTerms = this.extractDefinedTerms(rawText);
    const parties = this.extractParties(rawText);
    const effectiveDates = this.extractEffectiveDates(rawText);

    return {
      sections,
      definedTerms,
      parties,
      effectiveDates,
      rawText,
    };
  }

  extractDefinedTerms(rawText: string): DefinedTerm[] {
    const found = new Map<string, DefinedTerm>();

    for (const pattern of DEFINED_TERM_PATTERNS) {
      let match: RegExpExecArray | null;
      pattern.lastIndex = 0;
      while ((match = pattern.exec(rawText)) !== null) {
        const term = match[1].trim();
        if (term.length < 2 || term.length > 80) continue;

        const offset = match.index;
        const sectionTitle = this.getSectionAtOffset(rawText, offset);

        if (!found.has(term.toLowerCase())) {
          const usageCount = this.countUsages(rawText, term);
          const definition = this.extractDefinitionText(rawText, offset, term);

          found.set(term.toLowerCase(), {
            id: randomUUID(),
            term,
            definition,
            section: sectionTitle,
            firstUsed: offset,
            usageCount,
            inconsistentUsage: this.checkInconsistentUsage(rawText, term, definition),
          });
        }
      }
    }

    return Array.from(found.values()).sort((a, b) => a.firstUsed - b.firstUsed);
  }

  findUndefinedTerms(structure: DocumentStructure): string[] {
    const definedSet = new Set(structure.definedTerms.map((t) => t.term.toLowerCase()));
    const capitalizedTermRegex = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g;
    const undefined_: string[] = [];
    const seen = new Set<string>();

    let match: RegExpExecArray | null;
    while ((match = capitalizedTermRegex.exec(structure.rawText)) !== null) {
      const term = match[1];
      const lower = term.toLowerCase();
      if (!definedSet.has(lower) && !seen.has(lower) && !this.isCommonPhrase(term)) {
        seen.add(lower);
        undefined_.push(term);
      }
    }

    return undefined_;
  }

  // ─── Section extraction ───────────────────────────────────────────────────

  private extractSections(lines: string[], rawText: string): DocumentSection[] {
    const sections: DocumentSection[] = [];
    let offset = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const lineStart = rawText.indexOf(lines[i], offset);
      offset = lineStart + lines[i].length + 1;

      const heading = this.matchHeading(line);
      if (!heading) continue;

      const nextHeadingOffset = this.findNextHeadingOffset(rawText, offset, lines, i + 1);
      const content = rawText.slice(lineStart + line.length, nextHeadingOffset).trim();

      sections.push({
        id: randomUUID(),
        level: heading.level,
        title: heading.title,
        content,
        startOffset: lineStart,
        endOffset: nextHeadingOffset,
      });
    }

    return sections;
  }

  private matchHeading(
    line: string,
  ): { level: number; title: string } | null {
    let m: RegExpMatchArray | null;

    if ((m = line.match(NUMBERED_HEADING))) {
      const depth = m[1].split('.').length;
      return { level: depth, title: `${m[1]} ${m[2]}` };
    }
    if ((m = line.match(ROMAN_HEADING))) {
      return { level: 1, title: `${m[1]}. ${m[2]}` };
    }
    if ((m = line.match(LETTERED_HEADING))) {
      return { level: 2, title: `${m[1]}. ${m[2]}` };
    }
    if ((m = line.match(BOLD_ALL_CAPS_HEADING)) && line.length >= 5) {
      return { level: 1, title: m[1] };
    }

    return null;
  }

  private findNextHeadingOffset(
    rawText: string,
    fromOffset: number,
    lines: string[],
    fromLineIdx: number,
  ): number {
    let offset = fromOffset;
    for (let i = fromLineIdx; i < lines.length; i++) {
      const line = lines[i].trim();
      if (this.matchHeading(line)) {
        return rawText.indexOf(lines[i], offset);
      }
      offset += lines[i].length + 1;
    }
    return rawText.length;
  }

  // ─── Party extraction ─────────────────────────────────────────────────────

  private extractParties(rawText: string): DocumentParty[] {
    const parties: DocumentParty[] = [];
    const seen = new Set<string>();

    // Look in preamble (first 3000 chars) for higher signal
    const preamble = rawText.slice(0, 3000);

    for (const pattern of PARTY_PATTERNS) {
      let match: RegExpExecArray | null;
      pattern.lastIndex = 0;
      while ((match = pattern.exec(preamble)) !== null) {
        const name = match[1].trim().replace(/\s+/g, ' ');
        if (name.length > 3 && !seen.has(name.toLowerCase())) {
          seen.add(name.toLowerCase());
          parties.push({ name, role: 'party' });
        }
      }
    }

    // Label first as party, rest as counterparty
    return parties.map((p, idx) => ({
      ...p,
      role: idx === 0 ? 'party' : idx === 1 ? 'counterparty' : 'third_party',
    }));
  }

  // ─── Effective date extraction ────────────────────────────────────────────

  private extractEffectiveDates(rawText: string): string[] {
    const dates: string[] = [];
    const seen = new Set<string>();

    for (const pattern of EFFECTIVE_DATE_PATTERNS) {
      let match: RegExpExecArray | null;
      pattern.lastIndex = 0;
      while ((match = pattern.exec(rawText)) !== null) {
        const dateStr = match[1].trim();
        if (!seen.has(dateStr)) {
          seen.add(dateStr);
          dates.push(dateStr);
        }
      }
    }

    return dates;
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private getSectionAtOffset(rawText: string, offset: number): string {
    const textBefore = rawText.slice(0, offset);
    const lines = textBefore.split('\n').reverse();
    for (const line of lines) {
      const heading = this.matchHeading(line.trim());
      if (heading) return heading.title;
    }
    return 'Preamble';
  }

  private extractDefinitionText(rawText: string, offset: number, term: string): string {
    // Grab up to 400 chars after the match position
    const snippet = rawText.slice(offset, offset + 400);
    const periodIdx = snippet.indexOf('.');
    return periodIdx > 0 ? snippet.slice(0, periodIdx + 1).trim() : snippet.trim();
  }

  private countUsages(rawText: string, term: string): number {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`\\b${escaped}\\b`, 'gi');
    return (rawText.match(re) ?? []).length;
  }

  private checkInconsistentUsage(rawText: string, term: string, definition: string): boolean {
    // Simplified heuristic: if the term is used both with and without quotes differently
    const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const quotedUses = (rawText.match(new RegExp(`[""]${escapedTerm}[""]`, 'gi')) ?? []).length;
    const unquotedUses = (rawText.match(new RegExp(`\\b${escapedTerm}\\b`, 'gi')) ?? []).length;
    // If there are very few usages overall with mixed casing patterns → flag
    return quotedUses > 0 && unquotedUses > quotedUses * 3;
  }

  private isCommonPhrase(term: string): boolean {
    const commonPhrases = new Set([
      'The Parties',
      'The Agreement',
      'This Agreement',
      'The Contract',
      'The Company',
      'The Client',
      'Schedule',
      'Annexure',
      'Exhibit',
      'Clause',
      'Section',
      'Party',
      'Court',
      'India',
      'Act',
    ]);
    return commonPhrases.has(term);
  }
}
