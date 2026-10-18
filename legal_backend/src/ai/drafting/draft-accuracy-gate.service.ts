import { Injectable } from '@nestjs/common';
import type { DraftVerificationAudit } from './draft-verification.types';
import type { FilingReadinessReport } from './draft-verification.types';
import type { PreDraftChecklistResult } from './draft-pre-checklist.service';
import { detectLegalSafetyViolations } from './draft-legal-blocklist';
import type { FactCoverageResult } from './draft-case-fact-coverage.service';

export interface AccuracyGateInput {
  audit: DraftVerificationAudit;
  preDraft?: PreDraftChecklistResult;
  filingGrade: boolean;
  authorityCount: number;
  recommendedKind?: string;
  causeTitleVehicle?: string;
  draftText?: string;
  authoritiesOnPoint?: boolean;
  /** Defence-fact coverage from Case Brief. */
  factCoverage?: FactCoverageResult;
  /** Count of verified case-law authorities in registry. */
  verifiedCaseAuthorityCount?: number;
  /** Minimum case authorities required for lawyer_ready (playbook). */
  minVerifiedCaseAuthorities?: number;
  /** Async pleading review completed for filing-grade kinds. */
  pleadingReviewCompleted?: boolean;
  /** Unresolved HIGH findings after review loop. */
  unresolvedHighIssues?: number;
}

export type CertificationLabel =
  | 'lawyer_ready'
  | 'verified_for_filing'
  | 'complete_missing_facts'
  | 'needs_review';

export interface AccuracyGateResult {
  canCertify: boolean;
  canExport: boolean;
  exportWatermark?: string;
  certificationLabel: CertificationLabel;
  unresolvedFacts: string[];
  lawyerReady: boolean;
  filingReadiness: FilingReadinessReport;
}

@Injectable()
export class DraftAccuracyGateService {
  evaluate(input: AccuracyGateInput): AccuracyGateResult {
    const unresolvedFacts = input.preDraft?.unresolvedItems ?? [];
    const checklistComplete =
      !input.preDraft ||
      Object.values(input.preDraft.checklist).every((v) => v === true);

    const legalSafetyViolations =
      input.draftText && input.recommendedKind
        ? detectLegalSafetyViolations({
            draft: input.draftText,
            recommendedKind: input.recommendedKind,
            causeTitleVehicle: input.causeTitleVehicle,
          })
        : [];

    const hasLegalSafetyWarnings = input.audit.citationWarnings.some((w) =>
      /Legal safety/i.test(w),
    );
    const hasVerificationBlockers = (input.audit.findings ?? []).some(
      (finding) =>
        finding.severity === 'BLOCKER' &&
        (finding.state === 'FAIL' || finding.state === 'INDETERMINATE'),
    );

    // Claim-level BLOCKERs (passage / identity / treatment / register / fact) always block certify.
    const hasClaimBlockers = (input.audit.findings ?? []).some(
      (finding) =>
        finding.severity === 'BLOCKER' &&
        finding.state !== 'PASS' &&
        (finding.dimension === 'passage' ||
          finding.dimension === 'identity' ||
          finding.dimension === 'quotation' ||
          finding.dimension === 'treatment' ||
          finding.dimension === 'hierarchy' ||
          finding.dimension === 'application' ||
          finding.dimension === 'currentLaw' ||
          finding.checkId.startsWith('register:') ||
          finding.checkId.startsWith('fact-fidelity:') ||
          finding.checkId.startsWith('fact_fidelity:') ||
          finding.checkId.startsWith('fact_coverage:') ||
          finding.checkId.startsWith('procedural_timeline:') ||
          finding.checkId.startsWith('passage:') ||
          finding.checkId.startsWith('claim:') ||
          finding.checkId.startsWith('caselaw_retrieval:')),
    );

    const publicationBlocksCertify =
      input.audit.publicationState === 'VERIFICATION_UNAVAILABLE' ||
      input.audit.publicationState === 'DRAFT_NOT_VERIFIED';

    const canCertify =
      input.audit.verificationStatus === 'verified' &&
      input.audit.strippedCitations.length === 0 &&
      !input.audit.requiresLawyerReview &&
      !hasVerificationBlockers &&
      !hasClaimBlockers &&
      !publicationBlocksCertify &&
      checklistComplete &&
      input.authorityCount >= 1 &&
      input.authoritiesOnPoint !== false &&
      legalSafetyViolations.length === 0 &&
      !hasLegalSafetyWarnings;

    const coverageOk =
      !input.filingGrade ||
      !input.factCoverage ||
      input.factCoverage.coverageRate >= 0.85;
    const citationsOnGroundsOk =
      !input.filingGrade ||
      !input.factCoverage ||
      input.factCoverage.groundsWithoutCitation.length === 0;
    const caseLawOk =
      !input.filingGrade ||
      (input.verifiedCaseAuthorityCount ?? 0) >= (input.minVerifiedCaseAuthorities ?? 3);
    const reviewOk =
      !input.filingGrade ||
      input.pleadingReviewCompleted === true;
    const highIssuesOk = (input.unresolvedHighIssues ?? 0) === 0;

    const lawyerReady =
      canCertify &&
      input.filingGrade &&
      coverageOk &&
      citationsOnGroundsOk &&
      caseLawOk &&
      reviewOk &&
      highIssuesOk &&
      !hasClaimBlockers;

    let certificationLabel: CertificationLabel = 'needs_review';
    if (lawyerReady) {
      certificationLabel = 'lawyer_ready';
    } else if (canCertify) {
      certificationLabel = 'verified_for_filing';
    } else if (unresolvedFacts.length > 0 && input.audit.strippedCitations.length === 0) {
      certificationLabel = 'complete_missing_facts';
    } else {
      certificationLabel = 'needs_review';
    }

    const canExportForFiling = input.filingGrade ? lawyerReady : canCertify;
    const canExport = canExportForFiling;
    const exportWatermark = canExportForFiling
      ? undefined
      : 'WORKING DRAFT — NOT APPROVED FOR FILING';
    const mandatoryBlockers = [
      ...unresolvedFacts,
      ...legalSafetyViolations.map((violation) => violation.reason),
      ...(input.audit.completenessGaps ?? []),
      ...(hasVerificationBlockers ? ['Verification blockers remain.'] : []),
      ...(hasClaimBlockers ? ['Material claims lack verified support.'] : []),
      ...(!checklistComplete ? ['Pre-filing checklist is incomplete.'] : []),
      ...(!coverageOk ? ['Material fact coverage is below the filing threshold.'] : []),
      ...(!caseLawOk ? ['Required authorities are not verified.'] : []),
      ...(!reviewOk ? ['Human pleading review has not been recorded.'] : []),
      ...(!highIssuesOk ? ['High-severity review issues remain.'] : []),
    ];
    const filingReadiness: FilingReadinessReport = {
      status: canExportForFiling
        ? 'filing_ready'
        : canCertify
          ? 'lawyer_review_ready'
          : 'working_draft',
      canExportDraft: true,
      canExportForFiling,
      mandatoryBlockers: [...new Set(mandatoryBlockers)],
      checks: {
        facts: coverageOk && unresolvedFacts.length === 0 ? 'pass' : 'blocked',
        forum: legalSafetyViolations.length === 0 ? 'pass' : 'blocked',
        limitation: checklistComplete ? 'pass' : 'review',
        maintainability: legalSafetyViolations.length === 0 ? 'pass' : 'blocked',
        procedure: highIssuesOk ? 'pass' : 'blocked',
        calculation: /\b₹₹|₹\s*[,;]/.test(input.draftText ?? '')
          ? 'blocked'
          : 'review',
        relief: legalSafetyViolations.length === 0 ? 'pass' : 'blocked',
        evidence: hasClaimBlockers ? 'blocked' : 'pass',
        annexures: checklistComplete ? 'pass' : 'review',
        verification: hasVerificationBlockers ? 'blocked' : 'pass',
        currentLaw: publicationBlocksCertify ? 'blocked' : 'pass',
        humanReview: reviewOk ? 'pass' : 'blocked',
      },
    };

    return {
      canCertify: lawyerReady || canCertify,
      canExport,
      exportWatermark,
      certificationLabel,
      unresolvedFacts,
      lawyerReady,
      filingReadiness,
    };
  }
}
