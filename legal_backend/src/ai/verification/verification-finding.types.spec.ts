import {
  dedupeFindings,
  resolvePublicationState,
  type VerificationFinding,
} from './verification-finding.types';

describe('dedupeFindings', () => {
  it('keeps the worse state when dimension/proposition collide', () => {
    const findings: VerificationFinding[] = [
      {
        checkId: 'passage:prop_1',
        state: 'PASS',
        severity: 'LOW',
        dimension: 'passage',
        propositionId: 'prop_1',
        evidenceIds: [],
        explanation: 'ok',
        verifierVersion: 't',
      },
      {
        checkId: 'passage:prop_1:retry',
        state: 'FAIL',
        severity: 'BLOCKER',
        dimension: 'passage',
        propositionId: 'prop_1',
        evidenceIds: [],
        explanation: 'fail',
        verifierVersion: 't',
      },
    ];
    const deduped = dedupeFindings(findings);
    expect(deduped).toHaveLength(1);
    expect(deduped[0].state).toBe('FAIL');
    expect(resolvePublicationState(deduped)).toBe('DRAFT_NOT_VERIFIED');
  });
});
