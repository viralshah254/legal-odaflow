import { Injectable } from '@nestjs/common';
import type { GateFinding } from '../../contracts/release-gate';
import {
  AUTHORITY_GATE_FAIL_LABEL,
  evaluateAuthorityEnrichGate,
  type VerifiedAuthorityRecord,
} from '../../contracts/authority-verification';

const VERIFIER = 'authority-verification-gate-v1';

/**
 * Release-gate check for Table of Authorities / enrich results.
 * Blocks export when identity fails, relevance fails, type is misclassified,
 * or authorities are unrelated to the draft's propositions.
 */
@Injectable()
export class AuthorityVerificationGateValidator {
  readonly version = VERIFIER;

  evaluate(
    records: VerifiedAuthorityRecord[] | undefined | null,
    policy?: { minVerifiedCases?: number; requiredTopics?: string[] },
  ): GateFinding[] {
    const minVerifiedCases = policy?.minVerifiedCases ?? 0;
    if (!records || records.length === 0) {
      return minVerifiedCases > 0
        ? [
            {
              id: 'authority_verification:missing',
              checkId: 'authority_verification',
              severity: 'blocker',
              message: `Requires at least ${minVerifiedCases} verified case authorities; found 0.`,
              repairHint: 'Run proposition-based authority retrieval.',
            },
          ]
        : [];
    }

    const gate = evaluateAuthorityEnrichGate(records);
    const findings: GateFinding[] = gate.blockers.map(
      (message, i): GateFinding => ({
        id: `authority_verification:${i}`,
        checkId: 'authority_verification',
        severity: 'blocker',
        message,
        repairHint: AUTHORITY_GATE_FAIL_LABEL,
      }),
    );

    const verified = records.filter(
      (record) =>
        !record.excluded &&
        record.identityStatus === 'pass' &&
        record.relevanceStatus === 'pass' &&
        record.citedInDraft &&
        !record.authorityTypeMisclassified &&
        record.currentLawStatus !== 'overruled' &&
        record.currentLawStatus !== 'repealed',
    );
    const verifiedCases = verified.filter((record) => record.authorityType === 'case');
    if (verifiedCases.length < minVerifiedCases) {
      findings.push({
        id: 'authority_verification:minimum',
        checkId: 'authority_verification',
        severity: 'blocker',
        message: `Requires at least ${minVerifiedCases} verified case authorities; found ${verifiedCases.length}.`,
        repairHint: 'Run proposition-based authority retrieval.',
      });
    }

    for (const record of verified.filter((item) => item.currentLawStatus === 'unknown')) {
      findings.push({
        id: `authority_verification:current_law:${record.id}`,
        checkId: 'authority_current_law',
        severity: 'warning',
        message: `${record.citation}: current-law treatment is unknown and requires advocate review.`,
        repairHint: 'Confirm subsequent treatment before filing.',
      });
    }

    const authorityText = verified
      .map((record) => `${record.issue} ${record.proposition} ${(record.areas ?? []).join(' ')}`)
      .join(' ')
      .toLowerCase();
    for (const topic of policy?.requiredTopics ?? []) {
      const tokens = topic
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((token) => token.length > 3);
      if (tokens.length > 0 && !tokens.some((token) => authorityText.includes(token))) {
        findings.push({
          id: `authority_verification:topic:${topic}`,
          checkId: 'authority_topic_coverage',
          severity: 'blocker',
          message: `No verified authority supports the required proposition: ${topic}.`,
          repairHint: `Retrieve authority specifically for "${topic}".`,
        });
      }
    }

    return findings;
  }

  /** Standalone enrich-path evaluation (returns structured gate result). */
  evaluateEnrich(records: VerifiedAuthorityRecord[]) {
    return evaluateAuthorityEnrichGate(records);
  }
}
