import { mergeIntakeCaseBrief, partiesFromIntakeBrief, readIntakeCaseBrief } from './intake-case-brief';

describe('intake case brief', () => {
  it('persists classify outcomes, parties, and toolPlan on planningAnswers', () => {
    const merged = mergeIntakeCaseBrief({ existing: 'keep' }, {
      suggestedOutcomes: ['Regular bail'],
      parties: 'State vs Accused',
      toolPlan: ['retrieve', 'draft'],
      missingSlots: ['offenceDate'],
      recommendedNextTool: 'retrieve',
    });

    expect(merged.existing).toBe('keep');
    expect(readIntakeCaseBrief(merged)).toEqual({
      suggestedOutcomes: ['Regular bail'],
      parties: 'State vs Accused',
      toolPlan: ['retrieve', 'draft'],
      missingSlots: ['offenceDate'],
      recommendedNextTool: 'retrieve',
    });
  });

  it('extracts classified parties for the conflict check', () => {
    expect(
      partiesFromIntakeBrief(
        { parties: 'Acme Ltd vs Ravi Kumar' },
        [{ name: 'Acme Ltd', email: 'ops@acme.test' }],
      ),
    ).toEqual([
      { name: 'Acme Ltd', email: 'ops@acme.test' },
      { name: 'Ravi Kumar' },
    ]);
  });
});
