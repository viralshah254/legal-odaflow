import { Injectable } from '@nestjs/common';

export type CurrentLawStatus =
  | 'GOOD_LAW'
  | 'OVERRULED'
  | 'REVERSED'
  | 'DOUBTED'
  | 'DISTINGUISHED'
  | 'SUPERSEDED'
  | 'UNKNOWN';

export interface AuthorityTreatment {
  citation: string;
  title?: string;
  currentLawStatus: CurrentLawStatus;
  /** True when the status was confirmed (registry/explicit signal) vs defaulted. */
  verified: boolean;
}

interface RegistryLookup {
  citation: string | null;
  title: string;
  currentLawStatus?: string | null;
  reviewedByHuman?: boolean | null;
}

/**
 * Best-effort current-law / treatment checker. Determines whether cited cases are
 * still good law using (a) explicit overruled/doubted signals in the draft text and
 * (b) the verified authority registry. When treatment cannot be confirmed, status is
 * UNKNOWN and the output is labelled so the attorney knows it was not fully verified.
 */
@Injectable()
export class CurrentLawCheckerService {
  /**
   * Inspects the output text + registry treatment for a set of cited authorities.
   * `registryRecords` are passed in by the caller (which owns Prisma access) to keep
   * this service dependency-free and easily testable.
   */
  assess(params: {
    citations: string[];
    outputMarkdown: string;
    registryRecords?: RegistryLookup[];
  }): AuthorityTreatment[] {
    const registryByNorm = new Map<string, RegistryLookup>();
    for (const r of params.registryRecords ?? []) {
      if (r.citation) registryByNorm.set(this.norm(r.citation), r);
      registryByNorm.set(this.norm(r.title), r);
    }

    return params.citations.map((citation) => {
      const record = registryByNorm.get(this.norm(citation));

      // Explicit negative-treatment signal near the citation in the draft.
      const negative = this.detectNegativeTreatment(params.outputMarkdown, citation);
      if (negative) {
        return { citation, currentLawStatus: negative, verified: false };
      }

      if (record?.currentLawStatus) {
        return {
          citation,
          title: record.title,
          currentLawStatus: record.currentLawStatus as CurrentLawStatus,
          verified: !!record.reviewedByHuman,
        };
      }

      return { citation, currentLawStatus: 'UNKNOWN', verified: false };
    });
  }

  /**
   * Builds a note for the memo when any cited authority's treatment is unverified.
   */
  buildUnverifiedTreatmentNote(treatments: AuthorityTreatment[]): string | undefined {
    const unknown = treatments.filter((t) => t.currentLawStatus === 'UNKNOWN');
    if (unknown.length === 0) return undefined;
    return `Current-law treatment not fully verified for ${unknown.length} cited ${
      unknown.length === 1 ? 'authority' : 'authorities'
    }. Confirm the cases are still good law (not overruled, reversed, doubted, or superseded) before reliance.`;
  }

  /** Prompt instruction enforcing current-law discipline. */
  buildCurrentLawPromptBlock(requiresCheck: boolean): string {
    const lines = [
      'CURRENT-LAW DISCIPLINE:',
      '  - Do not imply a case is good law unless its treatment is checked or it is a verified authority.',
      '  - Flag any authority you cannot confirm as still good law with "Current-law treatment not fully verified".',
      '  - Do not rely on overruled, reversed, doubted, or superseded authority without an explicit warning.',
    ];
    if (requiresCheck) {
      lines.push(
        '  - This query requires a current-law check: state, for each leading authority, whether it is still good law or whether treatment is unverified.',
      );
    }
    return lines.join('\n');
  }

  private detectNegativeTreatment(
    markdown: string,
    citation: string,
  ): CurrentLawStatus | undefined {
    const idx = markdown.indexOf(citation);
    if (idx === -1) return undefined;
    // Inspect a window around the citation for treatment keywords.
    const window = markdown.slice(Math.max(0, idx - 160), idx + citation.length + 160).toLowerCase();
    if (/\boverruled\b/.test(window)) return 'OVERRULED';
    if (/\breversed\b/.test(window)) return 'REVERSED';
    if (/\bdoubted\b/.test(window)) return 'DOUBTED';
    if (/\bsuperseded\b/.test(window)) return 'SUPERSEDED';
    if (/\bdistinguished\b/.test(window)) return 'DISTINGUISHED';
    return undefined;
  }

  private norm(s: string): string {
    return s.toLowerCase().replace(/\s+/g, ' ').replace(/[.,;:]/g, '').trim();
  }
}
