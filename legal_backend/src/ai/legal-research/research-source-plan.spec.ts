import { resolveResearchSourcePlan } from './research-source-plan';

describe('resolveResearchSourcePlan', () => {
  const query =
    'What are similar cases in Indian law where arbitration clauses in partnership agreements were enforced or disputed, and what were the key outcomes?';

  it('searches primary law and live web discovery for an arbitration case survey', () => {
    const plan = resolveResearchSourcePlan({
      taskKind: 'CASE_SURVEY',
      legalDomain: 'ARBITRATION',
      query,
    });

    expect(plan.mode).toBe('AUTO');
    expect(plan.effectiveSources).toEqual(
      expect.arrayContaining(['case_law', 'statutes', 'web']),
    );
    expect(plan.effectiveSources).not.toEqual(
      expect.arrayContaining(['regulations']),
    );
  });

  it('keeps only implemented explicit source overrides', () => {
    const plan = resolveResearchSourcePlan({
      taskKind: 'CASE_SURVEY',
      legalDomain: 'ARBITRATION',
      query,
      requestedSources: ['case_law', 'tax', 'edgar'],
    });

    expect(plan).toEqual(
      expect.objectContaining({
        mode: 'CUSTOM',
        effectiveSources: ['case_law'],
      }),
    );
  });
});
