import {
  evaluateMatrimonialGoldenCase,
  MATRIMONIAL_RESEARCH_GOLDEN_CASES,
} from './matrimonial-research-golden.fixture';

describe('matrimonial research golden cases', () => {
  it('covers calibrated happy, good-faith edge, and adverse hard cases', () => {
    expect(MATRIMONIAL_RESEARCH_GOLDEN_CASES.map((item) => item.tier)).toEqual([
      'happy',
      'edge',
      'hard',
    ]);
    expect(
      MATRIMONIAL_RESEARCH_GOLDEN_CASES.map(evaluateMatrimonialGoldenCase),
    ).toEqual([
      { passed: true, failures: [] },
      { passed: true, failures: [] },
      { passed: true, failures: [] },
    ]);
  });

  it('fails release when a pinpoint gap is hidden', () => {
    const hard = MATRIMONIAL_RESEARCH_GOLDEN_CASES[2];
    const result = evaluateMatrimonialGoldenCase({
      ...hard,
      candidate: { ...hard.candidate, releaseState: 'READY_FOR_LAWYER' },
    });

    expect(result.passed).toBe(false);
    expect(result.failures).toEqual(
      expect.arrayContaining([
        expect.stringContaining('releaseState'),
        'pinpoint gaps must require lawyer review',
      ]),
    );
  });

  it('fails when an unproved good-faith complaint is overstated as proved', () => {
    const edge = MATRIMONIAL_RESEARCH_GOLDEN_CASES[1];
    const result = evaluateMatrimonialGoldenCase({
      ...edge,
      candidate: {
        ...edge.candidate,
        issues: edge.candidate.issues.map((issue) =>
          issue.issueId === 'unproved_complaint'
            ? { ...issue, finding: 'PROVED' }
            : issue,
        ),
      },
    });

    expect(result.passed).toBe(false);
    expect(result.failures).toContain(
      'unproved_complaint.finding: expected UNPROVED, got PROVED',
    );
  });
});
