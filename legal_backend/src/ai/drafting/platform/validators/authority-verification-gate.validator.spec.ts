import type { VerifiedAuthorityRecord } from '../../contracts/authority-verification';
import { AuthorityVerificationGateValidator } from './authority-verification-gate.validator';

function authority(overrides: Partial<VerifiedAuthorityRecord> = {}): VerifiedAuthorityRecord {
  return {
    id: 'case_1',
    authorityType: 'case',
    citation: '(2024) 1 SCC 1',
    title: 'Example v. Example',
    proposition: 'Order XXXVII applies to a written liquidated debt.',
    issue: 'order_37_maintainability',
    identityStatus: 'pass',
    relevanceStatus: 'pass',
    currentLawStatus: 'good_law',
    citedInDraft: true,
    authorityTypeMisclassified: false,
    excluded: false,
    ...overrides,
  };
}

describe('AuthorityVerificationGateValidator', () => {
  const validator = new AuthorityVerificationGateValidator();

  it('blocks when a required case-law minimum is not met', () => {
    const findings = validator.evaluate([authority()], { minVerifiedCases: 2 });
    expect(findings.some((finding) => finding.id === 'authority_verification:minimum')).toBe(true);
  });

  it('blocks overruled authority and missing proposition coverage', () => {
    const findings = validator.evaluate(
      [authority({ currentLawStatus: 'overruled' })],
      { minVerifiedCases: 1, requiredTopics: ['leave to defend'] },
    );
    expect(findings.some((finding) => finding.severity === 'blocker')).toBe(true);
    expect(findings.some((finding) => finding.checkId === 'authority_topic_coverage')).toBe(true);
  });

  it('passes verified, relevant, current authorities with topic coverage', () => {
    const findings = validator.evaluate(
      [
        authority(),
        authority({
          id: 'case_2',
          citation: '(2023) 2 SCC 2',
          proposition: 'Leave to defend requires a substantial defence.',
          issue: 'leave_to_defend',
        }),
      ],
      {
        minVerifiedCases: 2,
        requiredTopics: ['Order XXXVII maintainability', 'leave to defend'],
      },
    );
    expect(findings.filter((finding) => finding.severity === 'blocker')).toEqual([]);
  });
});
