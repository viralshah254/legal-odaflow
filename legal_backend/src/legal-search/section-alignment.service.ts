import { Injectable } from '@nestjs/common';

export interface SectionAlignmentInput {
  requestedActId: string;
  requestedSection: string;
  statuteShortName: string;
  outputMarkdown: string;
  authorities: Array<{
    id: string;
    title: string;
    citation: string | null;
    fullText?: string | null;
    summary?: string | null;
  }>;
  /** True when the exact section was found in corpus and pinned. */
  exactSectionInCorpus: boolean;
}

export interface SectionAlignmentResult {
  passed: boolean;
  warnings: string[];
}

const EXISTENCE_DENIAL_PATTERNS = [
  /does not exist/i,
  /no such section/i,
  /not found in (the )?act/i,
  /doesn['']?t exist/i,
  /is not (a )?(?:section|provision) (in|of)/i,
  /section.*?does not appear/i,
];

const SUGGESTION_FRAMING_PATTERNS = [
  /perhaps you meant/i,
  /did you mean/i,
  /you may be looking for/i,
  /suggest(?:ing|ed)?.*section/i,
  /alternative(?:ly)?,?\s+section/i,
  /related section/i,
];

@Injectable()
export class SectionAlignmentService {
  check(input: SectionAlignmentInput): SectionAlignmentResult {
    const warnings: string[] = [];
    let passed = true;

    const normalizedSection = input.requestedSection.replace(/^0+/, '').toUpperCase();
    const actLabel = input.statuteShortName;

    // 1. Existence denial: output says section doesn't exist but corpus has it.
    if (input.exactSectionInCorpus) {
      const denies = EXISTENCE_DENIAL_PATTERNS.some((p) => p.test(input.outputMarkdown));
      if (denies) {
        passed = false;
        warnings.push(
          `Section alignment failed: the output claims ${actLabel} s.${normalizedSection} does not exist, ` +
            `but it was found in the corpus. Do not deny existence of a section that has been retrieved.`,
        );
      }
    }

    // 2. Section substitution: output mentions a different section number from the same act
    //    without suggestion framing (e.g. "BNSS s.436" when user asked for s.101).
    const sectionCitePattern = new RegExp(
      `\\b${actLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*(?:s\\.?|section)\\s*(\\d+[A-Za-z]?)\\b`,
      'gi',
    );
    const citedSections = new Set<string>();
    for (const m of input.outputMarkdown.matchAll(sectionCitePattern)) {
      citedSections.add(m[1].replace(/^0+/, '').toUpperCase());
    }

    const isSuggestionContext = SUGGESTION_FRAMING_PATTERNS.some((p) =>
      p.test(input.outputMarkdown),
    );

    for (const cited of citedSections) {
      if (cited !== normalizedSection && !isSuggestionContext) {
        passed = false;
        warnings.push(
          `Section alignment failed: the query requested ${actLabel} s.${normalizedSection} but ` +
            `the answer cites ${actLabel} s.${cited}. Do not substitute a different section.`,
        );
      }
    }

    // 3. Exact section in authorities but output discusses a completely different section.
    //    Detected when: no citation for requested section + at least one citation for another section.
    if (input.exactSectionInCorpus && !citedSections.has(normalizedSection) && citedSections.size > 0) {
      passed = false;
      warnings.push(
        `Section alignment failed: ${actLabel} s.${normalizedSection} was retrieved and pinned ` +
          `but the answer does not cite it and instead discusses a different section.`,
      );
    }

    return { passed, warnings };
  }
}
