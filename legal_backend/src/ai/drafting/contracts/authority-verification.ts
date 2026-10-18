/**
 * Authority verification contracts — proposition-first retrieval & release gate.
 * Existence/currentness alone is never enough to display "Good Law".
 */

export type AuthorityType =
  | 'case'
  | 'statute'
  | 'rule'
  | 'regulation'
  | 'constitution'
  | 'notification'
  | 'secondary_source';

export type VerificationCheckStatus = 'pass' | 'fail' | 'indeterminate';

export type CurrentLawStatus = 'good_law' | 'overruled' | 'repealed' | 'unknown';

/** Narrow retrieval plan generated before any authority search. */
export interface AuthorityRetrievalPlan {
  jurisdiction: string;
  documentKind: string;
  legalIssues: string[];
  permittedStatutes: string[];
  excludedDomains: string[];
  requiredTopics: string[];
}

/** A legal proposition extracted from the draft, used as the retrieval unit. */
export interface DraftAuthorityProposition {
  proposition: string;
  issue: string;
  documentKind: string;
  /** Prefer case_law vs statutes for this proposition. */
  preferredAuthorityType: 'case' | 'statute' | 'constitution' | 'any';
}

export interface VerifiedAuthorityRecord {
  id: string;
  authorityType: AuthorityType;
  citation: string;
  title: string;
  /** Draft proposition this authority is claimed to support. */
  proposition: string;
  issue: string;
  identityStatus: VerificationCheckStatus;
  relevanceStatus: VerificationCheckStatus;
  currentLawStatus: CurrentLawStatus;
  citedInDraft: boolean;
  authorityTypeMisclassified: boolean;
  excluded: boolean;
  exclusionReason?: string;
  court?: string;
  decisionYear?: number;
  sourceUrl?: string;
  holding?: string;
  areas?: string[];
}

export interface AuthorityEnrichGateResult {
  canExport: boolean;
  status: 'pass' | 'fail';
  userLabel: string;
  blockers: string[];
  verifiedCount: number;
  excludedCount: number;
}

export const AUTHORITY_GATE_FAIL_LABEL =
  'Authority verification failed — unrelated authorities retrieved. Exclude and rerun proposition-based retrieval.';

export function evaluateAuthorityEnrichGate(
  records: VerifiedAuthorityRecord[],
): AuthorityEnrichGateResult {
  const displayed = records.filter((r) => !r.excluded);
  const blockers: string[] = [];

  for (const r of displayed) {
    if (r.identityStatus === 'fail') {
      blockers.push(`${r.citation}: identity verification failed`);
    }
    if (r.relevanceStatus !== 'pass') {
      blockers.push(`${r.citation}: relevance verification did not pass`);
    }
    if (!r.citedInDraft) {
      blockers.push(`${r.citation}: not cited in draft`);
    }
    if (r.authorityTypeMisclassified) {
      blockers.push(`${r.citation}: authority type misclassified`);
    }
  }

  // Soft fail: if we had candidates but every one was excluded → verification failed
  const excludedCount = records.filter((r) => r.excluded).length;
  if (records.length > 0 && displayed.length === 0 && excludedCount > 0) {
    blockers.push(AUTHORITY_GATE_FAIL_LABEL);
  }

  const canExport = blockers.length === 0;
  return {
    canExport,
    status: canExport ? 'pass' : 'fail',
    userLabel: canExport
      ? 'Authorities verified for draft propositions'
      : AUTHORITY_GATE_FAIL_LABEL,
    blockers,
    verifiedCount: displayed.length,
    excludedCount,
  };
}
