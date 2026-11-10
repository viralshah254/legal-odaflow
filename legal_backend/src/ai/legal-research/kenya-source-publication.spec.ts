import { kenyaSourcePublication } from './kenya-source-publication';
describe('Kenya source publication without reliance certification', () => {
  const checked = { state: 'VERIFIED_WITH_LIMITATIONS' as const, citations: [{ sourceVerified: true, verified: false }], findings: [], rejectedCount: 0, unsupportedCount: 0 };
  it('retains source-checked limitations without granting full certification', () => expect(kenyaSourcePublication(checked)).toBe('VERIFIED_WITH_LIMITATIONS'));
  it('rejects unresolved citations, missing sources and failed material findings', () => {
    expect(kenyaSourcePublication({ ...checked, unsupportedCount: 1 })).toBe('DRAFT_NOT_VERIFIED');
    expect(kenyaSourcePublication({ ...checked, citations: [] })).toBe('DRAFT_NOT_VERIFIED');
    expect(kenyaSourcePublication({ ...checked, state: 'VERIFICATION_UNAVAILABLE' })).toBe('VERIFICATION_UNAVAILABLE');
    expect(kenyaSourcePublication({ ...checked, findings: [{ checkId: 'bad', severity: 'HIGH', state: 'FAIL', dimension: 'passage', evidenceIds: [], explanation: 'Unsupported rule', verifierVersion: 'test' }] })).toBe('DRAFT_NOT_VERIFIED');
  });
});
