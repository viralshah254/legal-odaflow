import { FinalAssemblyService } from './final-assembly.service';
import type { SectionResult, DocumentOutline, LegalPlan, VerificationReport } from './drafting-v2.types';

describe('Final filing verification', () => {
  const service = new FinalAssemblyService(
    { buildFromSections: () => [] } as never,
    {} as never, {} as never, {} as never,
  );
  const section = (status: SectionResult['verificationStatus'], content: string): SectionResult => ({
    sectionId: 'grounds', type: 'grounds', title: 'GROUNDS', content,
    confidence: { score: 90, grade: 'high' } as SectionResult['confidence'],
    evidenceChains: [], verificationStatus: status, repairAttempts: 0,
    verificationWarnings: [], citationWarnings: [], modelUsed: 'test',
    tokensUsed: { input: 1, output: 1 }, explainability: {} as SectionResult['explainability'],
    isInjectedBoilerplate: false,
  });
  const assemble = (status: SectionResult['verificationStatus'], text: string) => service.assemble(
    [section(status, text)], { sections: [{ id: 'grounds' }] } as DocumentOutline,
    { documentKind: 'bail', filingGrade: true } as LegalPlan,
    {} as never, {} as never, 0,
  ).verificationReport;

  it.each(['limited_sources', 'needs_review'] as const)('cannot certify %s sections even without detected hallucinations', (status) => {
    const report = assemble(status, 'Reasoned grounds with incomplete source verification.');
    expect(report.canCertify).toBe(false);
    expect(report.requiresLawyerReview).toBe(true);
    expect(report.certificationLabel).not.toBe('verified_for_filing');
  });

  it('does not certify missing court, offence and authority placeholders', () => {
    const report = assemble('verified', 'Court: [BLANK: court]. Offence: [BLANK: sections]. [AUTHORITY GAP: bail principle]');
    expect(report.canCertify).toBe(false);
    expect(report.requiresLawyerReview).toBe(true);
  });

  it.each([true, false])('invalidates earlier verification after final revision or a high-severity coherence issue (revision=%s)', (revised) => {
    const report = { canCertify: true, certificationLabel: 'verified_for_filing', status: 'verified', requiresLawyerReview: false, overallWarnings: [] } as unknown as VerificationReport;
    service.applyFinalReview(report, revised, revised ? [] : ['Coherence: grounds do not support the relief']);
    expect(report.canCertify).toBe(false);
    expect(report.status).toBe('needs_review');
    expect(report.requiresLawyerReview).toBe(true);
  });
});
