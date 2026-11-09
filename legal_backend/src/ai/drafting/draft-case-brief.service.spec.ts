import { DraftCaseBriefService } from './draft-case-brief.service';
import { DraftProceduralTimelineValidator } from './draft-procedural-timeline.validator';
import { DraftCaseFactCoverageService } from './draft-case-fact-coverage.service';
import { DraftAccuracyGateService } from './draft-accuracy-gate.service';
import { DraftAmendmentApplierService } from './draft-amendment-applier.service';
import type { DraftVerificationAudit } from './draft-verification.types';

describe('Lawyer-ready drafting foundations', () => {
  const briefService = new DraftCaseBriefService();
  const timeline = new DraftProceduralTimelineValidator();
  const coverage = new DraftCaseFactCoverageService();
  const accuracyGate = new DraftAccuracyGateService();
  const applier = new DraftAmendmentApplierService();

  const rohanFacts = `Rohan Mehta v. State. FIR No. 42/2026 dated 17 February 2026, PS Cyber Crime.
Accused Rohan Mehta arrested 19 February 2026. Chargesheet filed 15 April 2026.
Co-accused granted bail. Defence: no CCTV produced; forensic imaging after seizure;
Wi-Fi / IP address alone insufficient; CDR issues; shopkeeper statement; intimidation;
cash recovery disputed. Seek regular bail under BNSS §480/§483.`;

  it('extracts Case Brief with FIR date, stage, and defence facts', () => {
    const brief = briefService.extract(rohanFacts, 'india_regular_bail_bnss_480');
    expect(brief.proceduralHistory.firDate).toMatch(/17/);
    expect(brief.proceduralStage).toBe('post_chargesheet');
    expect(brief.defenceFacts.length).toBeGreaterThan(2);
    expect(brief.proceduralHistory.coAccusedBailGranted).toBe(true);
    expect(briefService.buildRetrievalQueries(brief, 'india_regular_bail_bnss_480').length).toBeGreaterThan(2);
  });

  it('does not turn missing-intake prose into FIR or arrest dates', () => {
    const brief = briefService.extract(
      'No offence, FIR, court, personal facts, dates or evidence has been provided. Discuss a historical arrest safeguard.',
      'india_regular_bail_bnss_480',
    );
    expect(brief.proceduralHistory.firDate).toBeUndefined();
    expect(brief.proceduralHistory.arrestDate).toBeUndefined();
    expect(brief.blanks.firDate).toBe(true);
    expect(brief.missingCriticalFields).toContain('firDate');
  });

  it('flags wrong FIR date, investigation ongoing, and Section 173 misuse', () => {
    const brief = briefService.extract(rohanFacts, 'india_regular_bail_bnss_480');
    const badDraft = `Petitioner seeks bail. FIR dated 19 February 2026. Investigation is still ongoing.
Chargesheet filed under Section 173. Benefit of doubt.`;
    const findings = timeline.evaluate({
      draft: badDraft,
      caseDetails: rohanFacts,
      kind: 'india_regular_bail_bnss_480',
      brief,
    });
    expect(findings.some((f) => f.checkId.includes('fir_date'))).toBe(true);
    expect(findings.some((f) => f.checkId.includes('investigation_ongoing'))).toBe(true);
    expect(findings.some((f) => f.checkId.includes('section_173'))).toBe(true);
    expect(findings.some((f) => f.checkId.includes('petitioner_label'))).toBe(true);
  });

  it('scores fact coverage and citation gaps on grounds', () => {
    const brief = briefService.extract(rohanFacts, 'india_regular_bail_bnss_480');
    const goodDraft = `Applicant–Accused Rohan Mehta. FIR 17 February 2026.
GROUNDS FOR BAIL:
A) CCTV not produced — Satender Kumar Antil v. CBI (2022) 10 SCC 51.
B) Forensic imaging timeline — Sanjay Chandra v. CBI (2012) 1 SCC 40.
C) Parity co-accused bail — Prasanta Kumar Sarkar (2010) 14 SCC 496.
D) Wi-Fi IP insufficiency — Arnesh Kumar (2014) 8 SCC 273.
E) CDR and shopkeeper and intimidation and cash — Antil (2022) 10 SCC 51.
PRAYER: bail.`;
    const result = coverage.evaluate({
      draft: goodDraft,
      brief,
      kind: 'india_regular_bail_bnss_480',
      filingGrade: true,
    });
    expect(result.coverageRate).toBeGreaterThanOrEqual(0.3);
  });

  it('certifies lawyer_ready when all gates pass', () => {
    const brief = briefService.extract(rohanFacts, 'india_regular_bail_bnss_480');
    const draft = `Applicant–Accused. FIR 17 Feb. GROUNDS: A) Antil (2022) 10 SCC 51.`;
    const factCoverage = coverage.evaluate({
      draft: `${draft} CCTV forensic parity Wi-Fi CDR shopkeeper intimidation cash`,
      brief,
      kind: 'india_regular_bail_bnss_480',
      filingGrade: true,
    });
    const audit: DraftVerificationAudit = {
      corrections: [],
      similarCases: [{ authorityId: 'a1' } as DraftVerificationAudit['similarCases'][number]],
      sectionChecks: { entries: [], anyCorrections: false, anyUnconfirmedMismatches: false },
      citationWarnings: [],
      strippedCitations: [],
      proceduralWarnings: [],
      completenessGaps: [],
      requiresLawyerReview: false,
      verificationStatus: 'verified',
      findings: [],
    };
    const gate = accuracyGate.evaluate({
      audit,
      filingGrade: true,
      authorityCount: 5,
      authoritiesOnPoint: true,
      draftText: draft,
      recommendedKind: 'india_regular_bail_bnss_480',
      factCoverage: { ...factCoverage, groundsWithoutCitation: [], coverageRate: 0.9 },
      verifiedCaseAuthorityCount: 3,
      minVerifiedCaseAuthorities: 3,
      pleadingReviewCompleted: true,
      unresolvedHighIssues: 0,
    });
    expect(gate.lawyerReady).toBe(true);
    expect(gate.certificationLabel).toBe('lawyer_ready');
    expect(gate.exportWatermark).toBeUndefined();
  });

  it('applies safe amendments', () => {
    const result = applier.apply('The Petitioner seeks bail. Investigation is still ongoing.', [
      {
        originalText: 'Petitioner',
        suggestedText: 'Applicant–Accused',
        reason: 'label',
        autoApplicable: true,
        severity: 'HIGH',
        category: 'label',
      },
      {
        originalText: 'Investigation is still ongoing',
        suggestedText: 'chargesheet has already been filed',
        reason: 'stage',
        autoApplicable: true,
        severity: 'HIGH',
        category: 'timeline',
      },
    ]);
    expect(result.draft).toContain('Applicant–Accused');
    expect(result.draft).toContain('chargesheet has already been filed');
    expect(result.applied).toHaveLength(2);
  });
});
