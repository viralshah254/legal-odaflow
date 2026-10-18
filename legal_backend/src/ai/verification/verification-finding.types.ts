export type CheckState = 'PASS' | 'FAIL' | 'INDETERMINATE' | 'NOT_APPLICABLE';

export type FindingSeverity = 'BLOCKER' | 'HIGH' | 'MEDIUM' | 'LOW';

export type RepairAction = 'RETRIEVE' | 'NARROW' | 'RECITE' | 'REMOVE' | 'QUALIFY' | 'ABSTAIN';

export type VerificationDimension =
  | 'identity'
  | 'relevance'
  | 'passage'
  | 'pinpoint'
  | 'quotation'
  | 'jurisdiction'
  | 'hierarchy'
  | 'treatment'
  | 'currentLaw'
  | 'application'
  | 'citation'
  | 'coverage'
  /** Internal consistency of the document: parties, chronology, grounds vs relief. */
  | 'coherence'
  | 'system';

export type PublicationState =
  | 'DRAFT_NOT_VERIFIED'
  | 'RESEARCH_BACKED'
  | 'VERIFIED_WITH_LIMITATIONS'
  | 'READY_FOR_LAWYER_REVIEW'
  | 'VERIFICATION_UNAVAILABLE';

export interface VerificationFinding {
  checkId: string;
  state: CheckState;
  severity: FindingSeverity;
  dimension: VerificationDimension;
  propositionId?: string;
  authorityId?: string;
  evidenceIds: string[];
  explanation: string;
  repairAction?: RepairAction;
  verifierVersion: string;
}

export interface VerificationDimensionSummary {
  state: CheckState;
  pass: number;
  fail: number;
  indeterminate: number;
  notApplicable: number;
}

export type VerificationDimensions = Record<
  'identity' | 'relevance' | 'passage' | 'pinpoint' | 'quotation' | 'currentLaw' | 'treatment' | 'hierarchy' | 'coverage',
  VerificationDimensionSummary
>;

export interface VerifiedPropositionSummary {
  id: string;
  text: string;
  type: string;
  materiality: 'MATERIAL' | 'SUPPORTING';
  evidenceIds: string[];
  supportState: CheckState | 'SUPPORTED' | 'PARTIAL' | 'UNSUPPORTED' | 'CONTRADICTED';
}

export function createEmptyDimensions(): VerificationDimensions {
  const empty = (): VerificationDimensionSummary => ({
    state: 'NOT_APPLICABLE',
    pass: 0,
    fail: 0,
    indeterminate: 0,
    notApplicable: 0,
  });
  return {
    identity: empty(),
    relevance: empty(),
    passage: empty(),
    pinpoint: empty(),
    quotation: empty(),
    currentLaw: empty(),
    treatment: empty(),
    hierarchy: empty(),
    coverage: empty(),
  };
}

export function summarizeFindings(findings: VerificationFinding[]): VerificationDimensions {
  const dimensions = createEmptyDimensions();
  for (const dimension of Object.keys(dimensions) as Array<keyof VerificationDimensions>) {
    const related = findings.filter((f) => f.dimension === dimension);
    if (related.length === 0) {
      dimensions[dimension].notApplicable = 1;
      continue;
    }
    const summary = dimensions[dimension];
    summary.pass = related.filter((f) => f.state === 'PASS').length;
    summary.fail = related.filter((f) => f.state === 'FAIL').length;
    summary.indeterminate = related.filter((f) => f.state === 'INDETERMINATE').length;
    summary.notApplicable = related.filter((f) => f.state === 'NOT_APPLICABLE').length;
    summary.state =
      summary.fail > 0
        ? 'FAIL'
        : summary.indeterminate > 0
          ? 'INDETERMINATE'
          : summary.pass > 0
            ? 'PASS'
            : 'NOT_APPLICABLE';
  }
  return dimensions;
}

export function resolvePublicationState(findings: VerificationFinding[]): PublicationState {
  const blockers = findings.filter((f) => f.severity === 'BLOCKER');
  if (blockers.some((f) => f.state === 'FAIL')) return 'DRAFT_NOT_VERIFIED';
  if (blockers.some((f) => f.state === 'INDETERMINATE')) return 'VERIFICATION_UNAVAILABLE';
  if (findings.some((f) => f.state === 'FAIL' || f.state === 'INDETERMINATE')) {
    return 'VERIFIED_WITH_LIMITATIONS';
  }
  if (findings.some((f) => f.state === 'PASS')) return 'READY_FOR_LAWYER_REVIEW';
  return 'RESEARCH_BACKED';
}

const STATE_RANK: Record<CheckState, number> = {
  FAIL: 4,
  INDETERMINATE: 3,
  PASS: 2,
  NOT_APPLICABLE: 1,
};

const SEVERITY_RANK: Record<FindingSeverity, number> = {
  BLOCKER: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

/**
 * Collapse duplicate document-level + claim-level findings for the same
 * dimension / proposition / authority so blocker counts stay meaningful.
 */
export function dedupeFindings(findings: VerificationFinding[]): VerificationFinding[] {
  const byKey = new Map<string, VerificationFinding>();
  for (const finding of findings) {
    const checkPrefix = finding.checkId.split(':').slice(0, 2).join(':');
    const key = [
      finding.dimension,
      finding.propositionId ?? '',
      finding.authorityId ?? '',
      checkPrefix,
    ].join('|');
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, finding);
      continue;
    }
    const worseState = STATE_RANK[finding.state] > STATE_RANK[existing.state];
    const sameStateWorseSeverity =
      finding.state === existing.state &&
      SEVERITY_RANK[finding.severity] > SEVERITY_RANK[existing.severity];
    if (worseState || sameStateWorseSeverity) {
      byKey.set(key, finding);
    }
  }
  return [...byKey.values()];
}
