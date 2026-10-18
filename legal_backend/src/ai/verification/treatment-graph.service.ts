import { Injectable } from '@nestjs/common';
import type { VerificationFinding } from './verification-finding.types';

const ADVERSE = /\b(overruled|reversed|set\s*aside|repealed|superseded|negatived)\b/i;
const POSITIVE = /\b(followed|affirmed|applied|approved|relied)\b/i;
const CAUTION = /\b(distinguished|doubted|explained|considered)\b/i;

/**
 * Minimal good-law / treatment graph from citator-style signals on evidence metadata.
 * Unknown treatment → INDETERMINATE (fail-closed for publication of HOLDING/RULE).
 */
@Injectable()
export class TreatmentGraphService {
  findingForClaim(input: {
    claimId: string;
    evidenceIds: string[];
    treatmentSignals: Array<{
      authorityId?: string;
      treatment?: string | null;
      textHint?: string;
      verified?: boolean;
      sourceName?: string;
      sourceUrl?: string;
    }>;
    material: boolean;
  }): VerificationFinding {
    const { claimId, evidenceIds, treatmentSignals, material } = input;
    if (treatmentSignals.length === 0) {
      return {
        checkId: `treatment:${claimId}`,
        state: material ? 'INDETERMINATE' : 'NOT_APPLICABLE',
        severity: material ? 'MEDIUM' : 'LOW',
        dimension: 'treatment',
        propositionId: claimId,
        evidenceIds,
        explanation: material
          ? 'Good-law treatment unknown for this material proposition.'
          : 'Treatment check not required for non-material proposition.',
        repairAction: material ? 'ABSTAIN' : undefined,
        verifierVersion: 'treatment-graph-v1',
      };
    }

    const joined = treatmentSignals
      .map((s) => `${s.treatment ?? ''} ${s.textHint ?? ''}`)
      .join(' ');

    if (ADVERSE.test(joined)) {
      return {
        checkId: `treatment:${claimId}`,
        state: 'FAIL',
        severity: 'BLOCKER',
        dimension: 'treatment',
        propositionId: claimId,
        authorityId: treatmentSignals[0]?.authorityId,
        evidenceIds,
        explanation: 'Authority shows adverse subsequent treatment (overruled/reversed/superseded).',
        repairAction: 'REMOVE',
        verifierVersion: 'treatment-graph-v1',
      };
    }

    if (POSITIVE.test(joined) || CAUTION.test(joined)) {
      const verifiedSignal = treatmentSignals.find(
        (signal) =>
          signal.verified === true &&
          Boolean(signal.sourceName?.trim() || signal.sourceUrl?.trim()),
      );
      if (!verifiedSignal) {
        return {
          checkId: `treatment:${claimId}`,
          state: 'INDETERMINATE',
          severity: material ? 'MEDIUM' : 'LOW',
          dimension: 'treatment',
          propositionId: claimId,
          authorityId: treatmentSignals[0]?.authorityId,
          evidenceIds,
          explanation:
            'Treatment keyword was present, but no reviewed or source-attributed treatment record verified it.',
          repairAction: material ? 'ABSTAIN' : 'QUALIFY',
          verifierVersion: 'treatment-graph-v2',
        };
      }
      return {
        checkId: `treatment:${claimId}`,
        state: 'PASS',
        severity: CAUTION.test(joined) ? 'MEDIUM' : 'LOW',
        dimension: 'treatment',
        propositionId: claimId,
        authorityId: treatmentSignals[0]?.authorityId,
        evidenceIds,
        explanation: CAUTION.test(joined)
          ? `Authority has source-attributed cautionary treatment (distinguished/doubted) from ${verifiedSignal.sourceName ?? verifiedSignal.sourceUrl}; qualify reliance.`
          : `Authority has source-attributed positive treatment from ${verifiedSignal.sourceName ?? verifiedSignal.sourceUrl}.`,
        repairAction: CAUTION.test(joined) ? 'QUALIFY' : undefined,
        verifierVersion: 'treatment-graph-v2',
      };
    }

    // Explicit but unrecognized status string → INDETERMINATE
    const hasExplicit = treatmentSignals.some((s) => (s.treatment ?? '').trim().length > 0);
    return {
      checkId: `treatment:${claimId}`,
      state: hasExplicit || material ? 'INDETERMINATE' : 'NOT_APPLICABLE',
      severity: material ? 'MEDIUM' : 'LOW',
      dimension: 'treatment',
      propositionId: claimId,
      evidenceIds,
      explanation: hasExplicit
        ? `Treatment status "${treatmentSignals[0]?.treatment}" could not be classified; treat as indeterminate.`
        : 'No subsequent-treatment signal available.',
      repairAction: 'ABSTAIN',
      verifierVersion: 'treatment-graph-v1',
    };
  }
}
