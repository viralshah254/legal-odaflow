import { Injectable } from '@nestjs/common';

export interface LegalSearchPlan {
  primaryQuery: string;
  expandedQueries: string[];
  limit: number;
  jurisdiction?: string;
  practiceArea?: string;
}

@Injectable()
export class LegalSearchPlanService {
  buildSearchPlan(input: {
    query: string;
    jurisdiction?: string;
    practiceArea?: string;
    limit?: number;
  }): LegalSearchPlan {
    const trimmed = input.query.trim();
    const expandedQueries = [trimmed];

    if (input.jurisdiction) {
      expandedQueries.push(`${trimmed} ${input.jurisdiction}`);
    }
    if (input.practiceArea) {
      expandedQueries.push(`${trimmed} ${input.practiceArea}`);
    }

    return {
      primaryQuery: trimmed,
      expandedQueries: [...new Set(expandedQueries)],
      limit: input.limit ?? 10,
      jurisdiction: input.jurisdiction,
      practiceArea: input.practiceArea,
    };
  }
}
