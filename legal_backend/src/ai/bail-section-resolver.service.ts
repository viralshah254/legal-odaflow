import { Injectable } from '@nestjs/common';

export type BailForum = 'magistrate' | 'sessions' | 'high_court';

export interface BailSectionResult {
  /** BNSS section number to invoke */
  section: '480' | '481' | '482' | '483';
  /** Human-readable label */
  label: string;
  /** Former CrPC equivalent */
  crpcEquivalent: string;
  /** Resolved forum */
  forum: BailForum;
  /** Reasoning for the resolution */
  reasoning: string;
}

/**
 * Deterministically resolves the correct BNSS bail provision from facts/court.
 *
 * Mapping:
 *   CrPC §436  → BNSS §481  (bailable offences — Magistrate)
 *   CrPC §437  → BNSS §480  (non-bailable — Magistrate)
 *   CrPC §438  → BNSS §482  (anticipatory bail — Sessions/HC)
 *   CrPC §439  → BNSS §483  (special powers — Sessions/HC post-rejection)
 *
 * Used by both the v3 drafting engine and the legal research agent so both
 * surfaces cite the same provision for the same factual scenario.
 */
@Injectable()
export class BailSectionResolverService {
  resolve(input: {
    documentKind: string;
    courtName?: string;
    rawFacts: string;
    /** Additional metadata — e.g. prior rejection flag from intake */
    priorRejection?: boolean;
  }): BailSectionResult {
    const kind = (input.documentKind ?? '').toLowerCase();
    const haystack = `${input.rawFacts ?? ''} ${input.courtName ?? ''}`.toLowerCase();

    if (!this.isBailKind(kind)) {
      return { section: '480', label: 'BNSS §480', crpcEquivalent: 'CrPC §437', forum: 'magistrate', reasoning: 'Not a bail kind' };
    }

    // Anticipatory bail — not yet arrested
    if (this.isAnticipatoryKind(kind, haystack)) {
      return {
        section: '482',
        label: 'BNSS §482 (Anticipatory Bail)',
        crpcEquivalent: 'CrPC §438',
        forum: 'sessions',
        reasoning: 'Anticipatory bail before arrest — BNSS §482',
      };
    }

    // High Court / Sessions special power — post-rejection or superior court facts
    if (this.isSessionsOrHCForum(haystack, input.priorRejection)) {
      return {
        section: '483',
        label: 'BNSS §483 (Special Powers — Sessions / HC)',
        crpcEquivalent: 'CrPC §439',
        forum: this.resolveHCOrSessions(haystack),
        reasoning: this.sessionsReasoning(haystack, input.priorRejection),
      };
    }

    // Magistrate-level: JMFC / CJM / MM explicitly mentioned
    if (this.isMagistrateForum(haystack)) {
      return {
        section: '480',
        label: 'BNSS §480 (Bail in Non-Bailable Offences — Magistrate)',
        crpcEquivalent: 'CrPC §437',
        forum: 'magistrate',
        reasoning: 'Magistrate court identified in facts — BNSS §480',
      };
    }

    // Ambiguous: default to §483 (most regular bail filings after arrest go to Sessions)
    return {
      section: '483',
      label: 'BNSS §483 (Special Powers — Sessions / HC)',
      crpcEquivalent: 'CrPC §439',
      forum: 'sessions',
      reasoning: 'No specific forum signals; defaulting to Sessions special power under BNSS §483 (most common path after arrest in non-bailable offences)',
    };
  }

  private isBailKind(kind: string): boolean {
    return /bail/i.test(kind);
  }

  private isAnticipatoryKind(kind: string, haystack: string): boolean {
    return /anticipatory/i.test(kind) || /anticipatory bail|apprehend.*arrest|fear.*arrest|not yet arrested/i.test(haystack);
  }

  private isSessionsOrHCForum(haystack: string, priorRejection?: boolean): boolean {
    return (
      priorRejection === true ||
      /sessions court|court of sessions|sessions judge|high court|\bhc\b|hon.*high court|high court of|division bench|db|principal district|principal judge/i.test(haystack) ||
      /reject(?:ed|ion)|dismiss(?:ed|al)|bail was refused|sessions.*order|order.*session|session.*rejected|refused by.*court|court.*refused bail|court.*dismissed/i.test(haystack) ||
      /successive bail|second bail|subsequent bail|third bail|fresh bail/i.test(haystack) ||
      /writ of habeas corpus/i.test(haystack)
    );
  }

  private isMagistrateForum(haystack: string): boolean {
    return /\bjmfc\b|\bcjm\b|\bmm\b|metropolitan magistrate|judicial magistrate|chief judicial magistrate|first class magistrate|magistrate court|magistrate's court/i.test(haystack);
  }

  private resolveHCOrSessions(haystack: string): BailForum {
    return /high court|\bhc\b|hon.*high court|high court of|writ|habeas/i.test(haystack) ? 'high_court' : 'sessions';
  }

  private sessionsReasoning(haystack: string, priorRejection?: boolean): string {
    if (priorRejection) return 'Prior bail rejection — Sessions/HC special power under BNSS §483';
    if (/high court|\bhc\b/i.test(haystack)) return 'High Court identified — BNSS §483 special power';
    if (/sessions/i.test(haystack)) return 'Sessions Court identified — BNSS §483 special power';
    if (/reject|dismiss|refused/i.test(haystack)) return 'Prior rejection inferred from facts — BNSS §483 special power';
    return 'Sessions/HC forum inferred from facts — BNSS §483';
  }
}
