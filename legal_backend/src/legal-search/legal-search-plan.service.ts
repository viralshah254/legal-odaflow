import { Injectable } from '@nestjs/common';
import type { LegalDomain } from '@/ai/legal-research/legal-research-classifier.service';
import { domainAnchors } from './legal-domain-profile';
import { expandQuery } from './statute-registry';
import type { StructuredLegalQueryContext } from './legal-retrieval.types';

export interface LegalSearchPlan extends StructuredLegalQueryContext {
  primaryQuery: string;
  expandedQueries: string[];
  limit: number;
  jurisdiction?: string;
  practiceArea?: string;
  legalDomain?: LegalDomain;
  isBareActQuery: boolean;
  searchTopics: string[];
  remappedSection?: { actId: string; section: string; note?: string };
}

@Injectable()
export class LegalSearchPlanService {
  buildSearchPlan(input: StructuredLegalQueryContext & {
    query: string;
    countryCode?: string;
    jurisdiction?: string;
    practiceArea?: string;
    legalDomain?: LegalDomain;
    limit?: number;
    /** Cap expanded query variants (FAST mode uses 3; default 10). */
    maxVariants?: number;
  }): LegalSearchPlan {
    const trimmed = input.query.trim();
    // An omitted jurisdiction must not pull India-only statute aliases into a
    // globally worded query. UNKNOWN intentionally yields generic expansion.
    const countryCode = (input.countryCode?.trim() || 'UNKNOWN').toUpperCase();
    const expansion = expandQuery(trimmed, countryCode);

    const expandedQueries = [...expansion.expandedQueries];

    if (input.jurisdiction) {
      expandedQueries.push(`${trimmed} ${input.jurisdiction}`);
    }
    if (input.practiceArea) {
      expandedQueries.push(`${trimmed} ${input.practiceArea}`);
    }
    const entityLabels = input.entities?.map((entity) => entity.text) ?? [];
    for (const anchor of domainAnchors(input.legalDomain, countryCode, entityLabels)) {
      expandedQueries.push(`${trimmed} ${anchor}`);
    }
    for (const decomposition of input.issueDecomposition ?? []) {
      expandedQueries.push(decomposition.issue);
      for (const subIssue of decomposition.subIssues ?? []) {
        expandedQueries.push(`${decomposition.issue} ${subIssue}`);
      }
    }
    for (const entity of entityLabels.slice(0, 3)) {
      for (const remedy of (input.remedies ?? []).slice(0, 3)) {
        expandedQueries.push(`${entity} ${remedy}`);
      }
    }

    const maxVariants = input.maxVariants ?? 10;

    return {
      primaryQuery: trimmed,
      expandedQueries: [...new Set(expandedQueries.filter(Boolean))].slice(0, maxVariants),
      limit: input.limit ?? 10,
      jurisdiction: input.jurisdiction,
      practiceArea: input.practiceArea,
      legalDomain: input.legalDomain,
      isBareActQuery: expansion.isBareActQuery,
      searchTopics: expansion.searchTopics,
      remappedSection: expansion.remappedSection,
      legalIssues: input.legalIssues,
      statuteSections: input.statuteSections,
      doctrines: input.doctrines,
      proceduralPosture: input.proceduralPosture,
      propositionPhrases: input.propositionPhrases,
      entities: input.entities,
      remedies: input.remedies,
      requestedAuthorityTypes: input.requestedAuthorityTypes,
      issueDecomposition: input.issueDecomposition,
    };
  }
}
