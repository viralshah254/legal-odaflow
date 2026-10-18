import type { CaseRecord } from '../contracts/case-record';
import type { CourtProfile } from '../legal/court-profile';
import type { AccuracyFinding } from './accuracy-finding';
import type {
  DraftDocumentFamily,
  DraftingAccuracyMode,
} from './draft-accuracy-orchestrator.service';

export type DraftFindingResolutionType =
  | 'automatic'
  | 'retrieval_required'
  | 'user_confirmation_required'
  | 'manual_legal_review_required'
  | 'non_repairable';

export type DraftRepairStatus =
  | 'not_started'
  | 'reviewing'
  | 'retrieving_sources'
  | 'repairing'
  | 'revalidating'
  | 'repaired'
  | 'needs_user_confirmation'
  | 'needs_advocate_review'
  | 'unresolved';

export type FinalDraftResolutionStatus =
  | 'clean'
  | 'repaired'
  | 'needs_user_confirmation'
  | 'needs_advocate_review'
  | 'blocked';

export interface DraftFindingRepairPolicy {
  code: string;
  resolutionType: DraftFindingResolutionType;
  maxAttempts: number;
  requiresCaseRecord: boolean;
  requiresPlaybook: boolean;
  requiresCourtProfile: boolean;
  requiresVerifiedStatute: boolean;
  requiresVerifiedAuthority: boolean;
  requiresUserConfirmationWhenAmbiguous: boolean;
  /** Prefer deterministic string repair before LLM. */
  preferDeterministic?: boolean;
}

export interface DraftRepairConfirmationQuestion {
  findingCode: string;
  field: string;
  question: string;
  options?: Array<{
    label: string;
    value: unknown;
    sourceIds: string[];
  }>;
}

export interface VerifiedStatuteReference {
  actId: string;
  section: string;
  title?: string;
  year?: string;
  proposition?: string;
  status?: 'current' | 'repealed' | 'amended' | 'unknown';
  source?: string;
}

export interface VerifiedAuthorityReference {
  citation: string;
  court?: string;
  year?: string;
  proposition?: string;
  passage?: string;
  verified: boolean;
  sourceId?: string;
}

export interface ResolvedFactValue {
  field: string;
  value: string;
  sourceIds: string[];
  confidence: 'confirmed' | 'extracted' | 'conflicted';
}

export interface ResolvedForum {
  forumName: string;
  courtProfileId?: string;
  courtProfileVersion?: string;
  partyTerminology?: { applicant: string; respondent: string };
  captionFormat?: string;
}

export interface DraftRepairConflict {
  field: string;
  findingCode?: string;
  description: string;
  candidates: Array<{ value: string; sourceIds: string[] }>;
}

export interface DraftRepairSourceResolution {
  facts: ResolvedFactValue[];
  statutes: VerifiedStatuteReference[];
  authorities: VerifiedAuthorityReference[];
  forum?: ResolvedForum;
  unresolvedConflicts: DraftRepairConflict[];
  courtProfile?: CourtProfile;
}

export interface DraftAccuracyRepairInput {
  draftText: string;
  caseRecord: CaseRecord;
  documentKind?: string;
  documentFamily?: DraftDocumentFamily;
  caseDetails?: string;
  requiredSections?: string[];
  playbookSummary?: string;
  courtProfile?: CourtProfile;
  verifiedStatutes?: VerifiedStatuteReference[];
  verifiedAuthorities?: VerifiedAuthorityReference[];
  findings: AccuracyFinding[];
  /** When false, skip LLM semantic repair. */
  allowSemanticRepair?: boolean;
}

export interface DraftAccuracyRepairResult {
  draftText: string;
  changed: boolean;
  appliedFindingCodes: string[];
  unresolvedFindingCodes: string[];
  requiresUserConfirmation: boolean;
  confirmationQuestions: DraftRepairConfirmationQuestion[];
  requiresAdvocateReview: boolean;
}

export interface DraftAutoRepairContext {
  draftText: string;
  caseRecord: CaseRecord;
  documentKind?: string;
  documentFamily?: DraftDocumentFamily;
  caseDetails?: string;
  requiredSections?: string[];
  consumerMatterSignals?: boolean;
  playbookSummary?: string;
  verifiedAuthorities?: VerifiedAuthorityReference[];
}

export interface DraftAutoRepairResult {
  draftText: string;
  caseRecord: CaseRecord;
  attempts: number;
  initialFindings: AccuracyFinding[];
  finalFindings: AccuracyFinding[];
  resolvedFindingCodes: string[];
  unresolvedFindingCodes: string[];
  repairDraftHashes: string[];
  requiresUserConfirmation: boolean;
  confirmationQuestions: DraftRepairConfirmationQuestion[];
  requiresAdvocateReview: boolean;
  finalStatus: FinalDraftResolutionStatus;
  repairStatus: DraftRepairStatus;
  mode: DraftingAccuracyMode;
}

export interface DraftRepairConfirmationAnswer {
  findingCode: string;
  field: string;
  value: unknown;
}
