import { evaluateKenyaLaunchGate } from './kenya-launch-gate';
import { KENYA_RESEARCH_BENCHMARK_MANIFEST } from './kenya-research-benchmark.manifest';

describe('Kenya research release gates', () => {
  it('covers the required Kenya legal research risk categories', () => {
    expect(
      new Set(KENYA_RESEARCH_BENCHMARK_MANIFEST.map((fixture) => fixture.category)),
    ).toEqual(
      new Set([
        'constitutional',
        'employment',
        'land',
        'procedure',
        'county_law',
        'privacy',
        'historical_version',
        'gazette_commencement',
        'bill_as_law',
        'fake_citation',
      ]),
    );
  });

  it('keeps engineering fixtures pending until Kenyan advocate approval', () => {
    expect(
      KENYA_RESEARCH_BENCHMARK_MANIFEST.every(
        (fixture) => fixture.advocateReviewStatus === 'PENDING',
      ),
    ).toBe(true);
  });

  it('blocks general availability on any prospective-authority leakage', () => {
    const result = evaluateKenyaLaunchGate('GENERAL_AVAILABILITY', {
      corpusCoverage: 1,
      freshnessSla: 1,
      retrievalRecall: 1,
      citationEntailment: 1,
      lawInForceAccuracy: 1,
      prospectiveAuthorityLeakage: 0.001,
      sourceHealth: 1,
      reviewBacklog: 0,
      advocateApprovedBenchmarks: 1,
    });

    expect(result.passed).toBe(false);
    expect(result.failures.join(' ')).toContain('prospectiveAuthorityLeakage');
  });

  it('blocks VERIFIED_BETA until advocate-approved benchmarks reach threshold', () => {
    const pendingShare =
      KENYA_RESEARCH_BENCHMARK_MANIFEST.filter(
        (fixture) => fixture.advocateReviewStatus === 'APPROVED',
      ).length / KENYA_RESEARCH_BENCHMARK_MANIFEST.length;

    const result = evaluateKenyaLaunchGate('VERIFIED_BETA', {
      corpusCoverage: 0.95,
      freshnessSla: 0.98,
      retrievalRecall: 0.9,
      citationEntailment: 0.99,
      lawInForceAccuracy: 0.99,
      prospectiveAuthorityLeakage: 0,
      sourceHealth: 0.99,
      reviewBacklog: 0,
      advocateApprovedBenchmarks: pendingShare,
    });

    expect(pendingShare).toBe(0);
    expect(result.passed).toBe(false);
    expect(result.failures.join(' ')).toContain('advocateApprovedBenchmarks');
  });

  it('requires abstention fixtures for bill-as-law and fake citations', () => {
    const abstainIds = KENYA_RESEARCH_BENCHMARK_MANIFEST.filter(
      (fixture) => fixture.shouldAbstain,
    ).map((fixture) => fixture.id);
    expect(abstainIds).toEqual(
      expect.arrayContaining([
        'ke-bill-is-not-law',
        'ke-fake-neutral-citation',
        'ke-historical-expression',
      ]),
    );
  });
});
