import { TreatmentGraphService } from './treatment-graph.service';

describe('TreatmentGraphService', () => {
  const service = new TreatmentGraphService();

  it('FAIL on overruled treatment', () => {
    const finding = service.findingForClaim({
      claimId: 'c1',
      evidenceIds: ['e1'],
      material: true,
      treatmentSignals: [{ authorityId: 'a1', treatment: 'overruled' }],
    });
    expect(finding.state).toBe('FAIL');
    expect(finding.severity).toBe('BLOCKER');
  });

  it('does not mistake this court reversing a lower court for later adverse treatment of this authority', () => {
    const finding = service.findingForClaim({ claimId: 'c1', evidenceIds: ['e1'], material: true, treatmentSignals: [{ authorityId: 'a1', textHint: 'The High Court judgment is reversed and the appeal allowed.' }] });
    expect(finding.state).toBe('INDETERMINATE');
  });

  it('INDETERMINATE when material and treatment unknown', () => {
    const finding = service.findingForClaim({
      claimId: 'c1',
      evidenceIds: ['e1'],
      material: true,
      treatmentSignals: [],
    });
    expect(finding.state).toBe('INDETERMINATE');
  });

  it('PASS on followed treatment', () => {
    const finding = service.findingForClaim({
      claimId: 'c1',
      evidenceIds: ['e1'],
      material: true,
      treatmentSignals: [
        {
          authorityId: 'a1',
          treatment: 'followed',
          verified: true,
          sourceName: 'Reviewed authority registry',
        },
      ],
    });
    expect(finding.state).toBe('PASS');
  });

  it('does not treat an unattributed positive keyword as verified good law', () => {
    const finding = service.findingForClaim({
      claimId: 'c1',
      evidenceIds: ['e1'],
      material: true,
      treatmentSignals: [{ authorityId: 'a1', treatment: 'followed' }],
    });
    expect(finding.state).toBe('INDETERMINATE');
    expect(finding.repairAction).toBe('ABSTAIN');
  });
});
