import { Injectable } from '@nestjs/common';
import { IndiaKanoonQueryBuilderService } from './india-kanoon-query-builder.service';

export interface EvidenceGap {
  issueId: string;
  issue: string;
  missingDimension:
    | 'PRIMARY_LAW'
    | 'BINDING_AUTHORITY'
    | 'PROCEDURAL_LAW'
    | 'CURRENT_TREATMENT'
    | 'JURISDICTION'
    | 'APPLICATION_SUPPORT'
    | 'ADVERSE_AUTHORITY'
    | 'COMPLETENESS';
  suggestedSearchTerms?: string[];
}

export interface GapQueryBuilderInput {
  criticalGaps: EvidenceGap[];
  originalQuery: string;
  countryCode: string;
  jurisdiction?: string;
  /** When true (DEEP/PREMIUM), always append adverse-authority + completeness queries. */
  includeAdversePass?: boolean;
}

/**
 * Converts evidence gaps into targeted search queries for deterministic expansion,
 * including adverse-authority and completeness passes for DEEP/PREMIUM modes.
 */
@Injectable()
export class GapQueryBuilderService {
  constructor(private readonly ikQueryBuilder: IndiaKanoonQueryBuilderService) {}

  build(input: GapQueryBuilderInput): string[] {
    const queries: string[] = [];
    const useIkSyntax = input.countryCode.toUpperCase() === 'IN';

    for (const gap of input.criticalGaps) {
      if (gap.suggestedSearchTerms?.length) {
        queries.push(...gap.suggestedSearchTerms);
        continue;
      }
      if (useIkSyntax) {
        queries.push(
          this.ikQueryBuilder.formatGapQuery(
            gap.issue,
            gap.missingDimension,
            input.jurisdiction,
          ),
        );
        continue;
      }
      switch (gap.missingDimension) {
        case 'PRIMARY_LAW':
          queries.push(`${gap.issue} statute section ${input.countryCode}`);
          break;
        case 'BINDING_AUTHORITY':
          queries.push(`${gap.issue} Supreme Court judgment ${input.countryCode}`);
          break;
        case 'PROCEDURAL_LAW':
          queries.push(`${gap.issue} procedure ${input.jurisdiction ?? input.countryCode}`);
          break;
        case 'CURRENT_TREATMENT':
          queries.push(`${gap.issue} latest position overruled amended`);
          break;
        case 'JURISDICTION':
          queries.push(`${gap.issue} ${input.jurisdiction ?? input.countryCode} jurisdiction`);
          break;
        case 'APPLICATION_SUPPORT':
          queries.push(`${gap.issue} application example factual scenario`);
          break;
        case 'ADVERSE_AUTHORITY':
          queries.push(`${gap.issue} overruled distinguished contrary view ${input.countryCode}`);
          break;
        case 'COMPLETENESS':
          queries.push(`${gap.issue} elements ingredients essentials ${input.countryCode}`);
          break;
      }
    }

    if (input.includeAdversePass) {
      queries.push(
        `${input.originalQuery} overruled reversed contrary authority ${input.countryCode}`,
        `${input.originalQuery} distinguished not followed ${input.jurisdiction ?? input.countryCode}`,
        `${input.originalQuery} essential ingredients completeness checklist`,
      );
    }

    return [...new Set(queries)].slice(0, 8);
  }
}
