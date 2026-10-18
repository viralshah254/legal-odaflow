import { Injectable } from '@nestjs/common';

export interface CaseLawCoverageSection {
  status: 'verified' | 'not_yet_verified' | 'partial';
  label: string;
  searchesAttempted: string[];
  unresolvedIssues: string[];
  authorities: Array<{ citation: string; proposition?: string; pinpoint?: string }>;
}

@Injectable()
export class CaseLawCoverageService {
  buildSection(input: {
    authorities: CaseLawCoverageSection['authorities'];
    searchesAttempted: string[];
    unresolvedIssues?: string[];
  }): CaseLawCoverageSection {
    if (input.authorities.length === 0) {
      return {
        status: 'not_yet_verified',
        label: 'Case law not yet verified',
        searchesAttempted: input.searchesAttempted,
        unresolvedIssues: input.unresolvedIssues ?? ['No relevant verifiable decision located'],
        authorities: [],
      };
    }
    return {
      status: 'verified',
      label: 'Case law coverage',
      searchesAttempted: input.searchesAttempted,
      unresolvedIssues: input.unresolvedIssues ?? [],
      authorities: input.authorities,
    };
  }
}
