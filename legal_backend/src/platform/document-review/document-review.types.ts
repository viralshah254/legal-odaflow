// Shared types for Phase 5: Document Review + Contract Intelligence

export interface DocumentSection {
  id: string;
  level: number;
  title: string;
  content: string;
  startOffset: number;
  endOffset: number;
}

export interface DefinedTerm {
  id: string;
  term: string;
  definition: string;
  section: string;
  firstUsed: number;
  usageCount: number;
  inconsistentUsage: boolean;
}

export interface DocumentParty {
  name: string;
  role: string;
}

export interface DocumentStructure {
  sections: DocumentSection[];
  definedTerms: DefinedTerm[];
  parties: DocumentParty[];
  effectiveDates: string[];
  rawText: string;
  pageCount?: number;
}

export type FindingCategory =
  | 'defined_terms'
  | 'obligations'
  | 'risk'
  | 'playbook'
  | 'formatting'
  | 'jurisdiction'
  | 'penalties'
  | 'indemnities'
  | 'liability'
  | 'data_protection'
  | 'termination'
  | 'missing_clause';

export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface ReviewFinding {
  id: string;
  category: FindingCategory;
  severity: FindingSeverity;
  title: string;
  description: string;
  sectionRef?: string;
  textRef?: string;
  playbookRef?: string;
  actionRequired: boolean;
  suggested?: string;
  redlineId?: string;
}

export type RedlineChangeType = 'replace' | 'delete' | 'insert';

export interface Redline {
  id: string;
  sectionRef: string;
  originalText: string;
  proposedText: string;
  reason: string;
  riskLevel: string;
  category: string;
  playbookRef?: string;
  /** Short unique substring to locate text in Word via Range.search */
  anchorText?: string;
  paragraphIndex?: number;
  changeType?: RedlineChangeType;
  severity?: FindingSeverity;
}

/** Structured edit operation for Office.js tracked-changes application */
export interface RedlineEditOp {
  id: string;
  changeType: RedlineChangeType;
  anchorText: string;
  originalText: string;
  proposedText: string;
  rationale: string;
  severity: FindingSeverity;
  sectionRef: string;
  paragraphIndex?: number;
  addComment: boolean;
}

export interface PlaybookDashboardSummary {
  unacceptable: number;
  fallback: number;
  preferred: number;
  missing: number;
  total: number;
}

export type PlaybookStatus = 'preferred' | 'acceptable' | 'flagged' | 'prohibited' | 'missing';

export interface PlaybookComparisonResult {
  clauseType: string;
  playbookId: string;
  found: boolean;
  status: PlaybookStatus;
  matchedText?: string;
  issue?: string;
  suggestedReplacement?: string;
}

export interface ObligationExtract {
  title: string;
  description: string;
  obligorParty: string;
  obligeeParty?: string;
  obligationType: string;
  dueDate?: Date;
  recurringSchedule?: string;
  consequences?: string;
}

export interface ClauseExtract {
  clauseType: string;
  title: string;
  rawText: string;
  section?: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskFactors: string[];
}

export interface RiskBreakdown {
  financial: number;
  legal: number;
  operational: number;
  data: number;
  overall: number;
}

export interface VersionDiff {
  type: 'addition' | 'deletion' | 'modification';
  section: string;
  before: string;
  after: string;
}
