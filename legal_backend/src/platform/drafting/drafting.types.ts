import type { DraftWorkspaceV3, DraftSectionV3 } from '@prisma/client';

export type { DraftWorkspaceV3, DraftSectionV3 };

// ─── Facts ───────────────────────────────────────────────────────────────────

export interface DraftFact {
  id: string;
  text: string;
  classification:
    | 'confirmed_fact'
    | 'user_allegation'
    | 'opposing_allegation'
    | 'legal_inference'
    | 'missing_evidence'
    | 'drafting_assumption';
  confidence: number;
  evidenceIds?: string[];
  sourceDocIds?: string[];
}

// ─── Procedural checks ───────────────────────────────────────────────────────

export interface ProceduralCheckResult {
  checkType: 'forum' | 'limitation' | 'standing' | 'remedy_availability' | 'required_notice' | 'jurisdiction';
  passed: boolean;
  message: string;
  severity: 'error' | 'warning' | 'info';
  sourceRef?: string;
}

// ─── Draft Plan ───────────────────────────────────────────────────────────────

export interface DraftPlan {
  id: string;
  objective: string;
  jurisdiction: { country: string; region?: string; court?: string };
  documentType: string;
  issues: string[];
  requiredAuthorities: string[];
  requiredEvidence: string[];
  proceduralChecks: ProceduralCheckResult[];
  assumedFacts: DraftFact[];
  risks: string[];
  openQuestions: string[];
}

// ─── Filing Readiness ─────────────────────────────────────────────────────────

export interface FilingBlocker {
  component:
    | 'cause_title'
    | 'jurisdiction'
    | 'limitation'
    | 'parties'
    | 'facts'
    | 'legal_grounds'
    | 'prayer'
    | 'formatting'
    | 'signatures'
    | 'affidavit'
    | 'verification'
    | 'annexures'
    | 'pagination'
    | 'court_formatting'
    | 'citations'
    | 'court_fees';
  severity: 'error' | 'warning';
  message: string;
  repairAction?: string;
}

export interface FilingReadinessReport {
  overallScore: number; // 0-100
  blockers: FilingBlocker[];
  componentScores: Record<string, number>;
  readyForFiling: boolean;
}

// ─── Verification ─────────────────────────────────────────────────────────────

export interface VerificationFinding {
  id: string;
  checkId?: string;
  sectionType?: string;
  dimension:
    | 'factual'
    | 'statutory'
    | 'case_law'
    | 'procedural'
    | 'structural'
    | 'logical'
    | 'jurisdictional'
    | 'formatting';
  severity: 'critical' | 'major' | 'minor' | 'info';
  status: 'failed' | 'warning' | 'passed' | 'not_checked';
  message: string;
  sectionId?: string;
  sourceRefs?: string[];
  repairable: boolean;
  suggestedAction?: string;
}

export interface RepairItem {
  findingId: string;
  sectionId: string;
  action: string;
  priority: number;
}

export interface RepairPlan {
  workspaceId: string;
  items: RepairItem[];
  estimatedSections: number;
  createdAt: string;
}

// ─── Adversarial review ───────────────────────────────────────────────────────

export interface AdversarialFinding {
  id: string;
  type:
    | 'procedural_objection'
    | 'weak_evidence'
    | 'contradiction'
    | 'overstatement'
    | 'missing_element'
    | 'jurisdiction_issue';
  severity: 'critical' | 'major' | 'minor';
  targetSectionId?: string;
  issue: string;
  suggestedRepair: string;
}

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface CreateDraftWorkspaceDto {
  matterId?: string;
  mode?: string;
  documentType?: string;
  objective?: string;
  jurisdiction?: string;
  region?: string;
  court?: string;
  riskLevel?: string;
  facts?: DraftFact[];
  existingCourtDraftId?: string;
  existingDraftingSessionId?: string;
}

export interface ExportDraftDto {
  format: 'pdf' | 'docx';
}

export interface RepairRequestDto {
  findingIds?: string[];
}
