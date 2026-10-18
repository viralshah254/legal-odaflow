import { DraftAccuracyGateService } from './draft-accuracy-gate.service';
import type { DraftVerificationAudit } from './draft-verification.types';

describe('DraftAccuracyGateService', () => {
  const service = new DraftAccuracyGateService();

  const baseAudit: DraftVerificationAudit = {
    corrections: [],
    similarCases: [{ authorityId: 'a1' } as DraftVerificationAudit['similarCases'][number]],
    sectionChecks: { entries: [], anyCorrections: false, anyUnconfirmedMismatches: false },
    citationWarnings: [],
    strippedCitations: [],
    proceduralWarnings: [],
    completenessGaps: [],
    requiresLawyerReview: false,
    verificationStatus: 'verified',
  };

  it('blocks filing certification but preserves draft export when blocker findings exist', () => {
    const result = service.evaluate({
      audit: {
        ...baseAudit,
        findings: [
          {
            checkId: 'passage:claim_1',
            state: 'INDETERMINATE',
            severity: 'BLOCKER',
            dimension: 'passage',
            evidenceIds: [],
            explanation: 'Passage verification unavailable.',
            verifierVersion: 'test',
          },
        ],
      },
      filingGrade: true,
      authorityCount: 1,
      authoritiesOnPoint: true,
    });

    expect(result.canCertify).toBe(false);
    expect(result.lawyerReady).toBe(false);
    expect(result.canExport).toBe(false);
    expect(result.filingReadiness.canExportDraft).toBe(true);
    expect(result.filingReadiness.canExportForFiling).toBe(false);
    expect(result.filingReadiness.status).toBe('working_draft');
    expect(result.exportWatermark).toBe('WORKING DRAFT — NOT APPROVED FOR FILING');
  });

  it('returns lawyer_ready when filing-grade gates pass', () => {
    const result = service.evaluate({
      audit: baseAudit,
      filingGrade: true,
      authorityCount: 5,
      authoritiesOnPoint: true,
      factCoverage: {
        coverageRate: 0.9,
        covered: ['a'],
        missing: [],
        findings: [],
        groundsWithoutCitation: [],
      },
      verifiedCaseAuthorityCount: 3,
      minVerifiedCaseAuthorities: 3,
      pleadingReviewCompleted: true,
      unresolvedHighIssues: 0,
    });
    expect(result.lawyerReady).toBe(true);
    expect(result.certificationLabel).toBe('lawyer_ready');
    expect(result.filingReadiness.status).toBe('filing_ready');
  });

  it('blocks canCertify when publicationState is VERIFICATION_UNAVAILABLE', () => {
    const result = service.evaluate({
      audit: {
        ...baseAudit,
        publicationState: 'VERIFICATION_UNAVAILABLE',
        findings: [],
      },
      filingGrade: true,
      authorityCount: 2,
      authoritiesOnPoint: true,
    });
    expect(result.canCertify).toBe(false);
  });
});
