import { UmbrellaLegalEvalHarness } from './umbrella-legal-eval.harness';

describe('Draft archetype golden matrix', () => {
  it('passes ≥95% of archetype×jurisdiction golden cases', () => {
    const harness = new UmbrellaLegalEvalHarness(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const result = harness.runDraftArchetypeGoldenBenchmark();
    expect(result.passed).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(0.95);
  });
});
