import { LegalRequestContext } from '../../common/types';

export interface ResearchPlan {
  id: string;
  objective: string;
  jurisdiction: { country: string; region?: string; court?: string };
  subQuestions: string[];
  sourceRequirements: string[];
  freshnessRequirement: 'current' | 'as_of_date' | 'historical';
  asOfDate?: string;
  exclusionRules?: string[];
  outputFormat: 'memo' | 'summary' | 'answer' | 'brief';
}

export interface LegalProposition {
  id: string;
  text: string;
  authorityIds: string[];
  factIds: string[];
  confidence: number;
  supportStatus: 'verified' | 'partially_supported' | 'unsupported' | 'conflicted';
}

export interface AuthorityReference {
  id: string;
  canonicalId: string;
  title: string;
  citation?: string;
  court?: string;
  jurisdiction: string;
  publicationDate?: string;
  treatmentStatus: string;
  authorityWeight: number;
  relevanceScore: number;
  snippet?: string;
  sourceUrl?: string;
}

export interface ConflictingAuthority {
  authorityA: AuthorityReference;
  authorityB: AuthorityReference;
  conflict: string;
}

export interface ResearchResult {
  id: string;
  workspaceId: string;
  summary: string;
  issues: string[];
  authorities: AuthorityReference[];
  conflictingAuthorities: ConflictingAuthority[];
  propositions: LegalProposition[];
  assumptions: string[];
  unansweredQuestions: string[];
  confidence: number;
  costUsd: number;
  generatedAt: string;
}

export type ResearchMode = 'quick' | 'deep' | 'matter_aware' | 'update';

export interface CreateResearchWorkflowDto {
  objective: string;
  jurisdiction: string;
  region?: string;
  court?: string;
  matterId?: string;
  mode?: ResearchMode;
  asOfDate?: string;
  sourcePreferences?: string[];
}

export type { LegalRequestContext };
