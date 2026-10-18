/** Gate findings + universal release gate result contracts */

export type GateFindingSeverity = 'blocker' | 'warning' | 'info';

export interface GateFinding {
  id: string;
  checkId: string;
  severity: GateFindingSeverity;
  message: string;
  evidence?: string[];
  repairHint?: string;
  playbookCheckId?: string;
}

export type ReleaseGateStatus =
  | 'automated_checks_passed'
  | 'lawyer_review_recommended'
  | 'draft_blocked';

/** Court-readiness progression for filing-grade exports. */
export type CourtReadyStatus =
  | 'not_ready'
  | 'system_validated'
  | 'advocate_review_required'
  | 'advocate_approved';

export interface AccuracyScorecard {
  qualityScore: number;
  factFidelityScore: number;
  legalAccuracyScore: number;
  proceduralAccuracyScore: number;
  completenessScore: number;
  citationQualityScore: number;
}

export interface CheckResult {
  passed: boolean;
  findings: GateFinding[];
  evidence?: string[];
  verifierVersion?: string;
}

export interface ReleaseGateResult {
  status: ReleaseGateStatus;
  /** Legacy automated-gate result. Prefer the explicit export fields below. */
  canExport: boolean;
  /** A watermarked/non-filing copy is available whenever draft text exists. */
  canExportReviewCopy: boolean;
  /** True only when automated checks and required human approval both pass. */
  canExportForFiling: boolean;
  blockers: GateFinding[];
  warnings: GateFinding[];
  checks: Record<string, CheckResult>;
  caseRecordVersion: number;
  playbookVersion: string;
  verifierVersions: Record<string, string>;
  /** Safe user-facing label — never "Verified draft". */
  userLabel: string;
  requiresHumanReview: boolean;
  courtReadyStatus?: CourtReadyStatus;
  scores?: AccuracyScorecard;
  /** Post automated review-and-repair resolution. */
  finalResolutionStatus?:
    | 'clean'
    | 'repaired'
    | 'needs_user_confirmation'
    | 'needs_advocate_review'
    | 'blocked';
  repairAttemptCount?: number;
  resolvedFindingCodes?: string[];
  unresolvedFindingCodes?: string[];
  confirmationQuestions?: Array<{
    findingCode: string;
    field: string;
    question: string;
    options?: Array<{ label: string; value: unknown; sourceIds: string[] }>;
  }>;
}

export function userLabelForStatus(status: ReleaseGateStatus): string {
  switch (status) {
    case 'automated_checks_passed':
      return 'Automated checks passed';
    case 'lawyer_review_recommended':
      return 'Lawyer review recommended';
    case 'draft_blocked':
      return 'Draft blocked — action required';
  }
}

export interface HumanReviewRecord {
  id: string;
  draftId: string;
  caseRecordId: string;
  caseRecordVersion: number;
  playbookVersion: string;
  draftHash: string;
  approved: boolean;
  reviewedByUserId: string;
  reviewedAt: string;
  notes?: string;
  invalidated?: boolean;
  invalidatedReason?: string;
}

export interface ValidationResult {
  ok: boolean;
  findings: GateFinding[];
  missingBlockingFields: string[];
}
