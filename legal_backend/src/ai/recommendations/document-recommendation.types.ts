export type DocumentRecommendationCategory =
  | 'work_product'
  | 'matter_evidence'
  | 'legal_authority';

export type DocumentRecommendationAction = 'draft' | 'collect' | 'research' | 'review';

export type PrerequisiteState =
  | 'missing'
  | 'mentioned'
  | 'uploaded'
  | 'extracted'
  | 'reviewed';

export interface DocumentRecommendation {
  id: string;
  category: DocumentRecommendationCategory;
  catalogId?: string;
  title: string;
  action: DocumentRecommendationAction;
  reason: string;
  factIds: string[];
  authorityEvidenceIds: string[];
  jurisdiction: string;
  proceduralStage?: string;
  prerequisites: Array<{
    id: string;
    state: PrerequisiteState;
    artifactVersionId?: string;
  }>;
  priority: 'next' | 'supporting' | 'later';
  status: 'proposed' | 'needs_clarification' | 'validated' | 'unsupported';
  questions: string[];
  contextRevision: number;
  policyVersion: string;
}
