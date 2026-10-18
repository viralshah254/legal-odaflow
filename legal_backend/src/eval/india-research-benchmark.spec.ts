import {
  INDIA_RESEARCH_ADVERSARIAL_FIXTURES,
  INDIA_RESEARCH_BENCHMARK_MANIFEST,
} from './india-research-benchmark.manifest';
import {
  confidenceCalibration,
  countScore,
  currentLawQualification,
  domainContaminationRate,
  evaluateIndiaResearchReleaseGate,
  falseVerificationRate,
  passageSupport,
  precisionAt5,
  requiredAuthorityRecall,
  scoreIndiaResearchBenchmark,
  sourceAvailability,
  type IndiaResearchLiveObservation,
  type RankedResearchAuthority,
} from './india-research-benchmark.metrics';

describe('India legal-research benchmark', () => {
  const partnership = INDIA_RESEARCH_BENCHMARK_MANIFEST.find(
    (benchmark) => benchmark.id === 'partnership-arbitration-nonregistration',
  )!;
  const transition = INDIA_RESEARCH_BENCHMARK_MANIFEST.find(
    (benchmark) => benchmark.category === 'current_law_transition',
  )!;

  it('covers every required section 6 research category', () => {
    expect(
      new Set(INDIA_RESEARCH_BENCHMARK_MANIFEST.map(({ category }) => category)),
    ).toEqual(
      new Set([
        'section_lookup',
        'case_lookup',
        'case_analysis',
        'case_comparison',
        'matter_opinion',
        'statute_interpretation',
        'procedure',
        'current_law_transition',
        'adverse_authority',
        'fake_citation_no_answer',
        'partnership_arbitration',
      ]),
    );
  });

  it('covers every routed research task with calibrated benchmark expectations', () => {
    expect(new Set(INDIA_RESEARCH_BENCHMARK_MANIFEST.map(({ taskKind }) => taskKind)))
      .toEqual(new Set([
        'SECTION_LOOKUP',
        'STATUTORY_INTERPRETATION',
        'CASE_LOOKUP',
        'CASE_ANALYSIS',
        'CASE_COMPARISON',
        'CITATION_VERIFICATION',
        'CURRENT_LAW',
        'ADVERSE_AUTHORITY',
        'PROCEDURE',
        'GENERAL_RESEARCH',
        'MATTER_OPINION',
      ]));
  });

  it('enumerates real legal-AI adversarial failures with fail-closed decisions', () => {
    expect(INDIA_RESEARCH_ADVERSARIAL_FIXTURES).toHaveLength(19);
    expect(INDIA_RESEARCH_ADVERSARIAL_FIXTURES.map(([id]) => id)).toEqual(
      expect.arrayContaining([
        'party-submission-as-holding',
        'dissent-as-majority',
        'amendment-not-commenced',
        'larger-bench-conflict',
        'unsupported-fact-application',
        'later-authority-silently-limits',
      ]),
    );
    expect(new Set(INDIA_RESEARCH_ADVERSARIAL_FIXTURES.map(([, , decision]) => decision)))
      .toEqual(new Set(['PARTIAL', 'GAP', 'ABSTAIN']));
  });

  it('covers every sections 9-10 adversarial failure category', () => {
    expect(
      new Set(
        INDIA_RESEARCH_BENCHMARK_MANIFEST.flatMap(
          ({ adversarialFailureCategories }) => adversarialFailureCategories,
        ),
      ),
    ).toEqual(
      new Set([
        'incorrect_plan',
        'missing_issue_dependency',
        'source_integrity_failure',
        'contrary_search_omission',
        'conflict_resolution_failure',
        'temporal_fidelity_failure',
        'fact_fidelity_failure',
        'unsupported_proposition',
        'confidence_miscalibration',
        'failure_to_abstain',
        'non_reproducible_result',
      ]),
    );
  });

  it('includes the exact partnership-arbitration comparison regression query', () => {
    const comparison = INDIA_RESEARCH_BENCHMARK_MANIFEST.find(
      (benchmark) => benchmark.id === 'case-comparison-partnership-arbitration-enforcement',
    );
    expect(comparison?.query).toMatch(/arbitration clauses in partnership agreements/i);
    expect(comparison?.requiredAuthorities.map(({ key }) => key)).toEqual(
      expect.arrayContaining(['vh-patel', 'jagdish-chander', 'purushottam-anil']),
    );
  });

  it('consolidates the partnership arbitration issue and controlling material', () => {
    expect(partnership.query).toMatch(/unregistered Indian partnership/i);
    expect(partnership.query).toMatch(/dissolution, accounts/i);
    expect(partnership.requiredAuthorities.map(({ key }) => key)).toEqual(
      expect.arrayContaining(['partnership-act-section-69', 'umesh-goel']),
    );
    expect(partnership.relevantAuthorities.map(({ key }) => key)).toContain(
      'partnership-act-section-69-3-a',
    );
  });

  it('computes deterministic ranking, authority, support, contamination and source metrics', () => {
    const authorities: RankedResearchAuthority[] = [
      {
        title: 'Umesh Goel v Himachal Pradesh Cooperative Group Housing Society',
        citation: '(2016) 11 SCC 313',
        domain: 'partnership arbitration',
        sourceAvailable: true,
      },
      {
        title: 'Indian Partnership Act, 1932',
        citation: 'section 69',
        domain: 'partnership',
        sourceAvailable: true,
      },
      {
        title: 'Arbitration and Conciliation Act, 1996',
        citation: 'section 11',
        domain: 'arbitration',
        sourceAvailable: false,
      },
      { title: 'Income Tax Act', domain: 'tax', relevant: false, sourceAvailable: true },
    ];
    const claims = [
      { expectedSupported: true, passageSupported: true, verified: true },
      { expectedSupported: true, passageSupported: false, verified: false },
      { expectedSupported: false, passageSupported: false, verified: true },
    ];

    expect(precisionAt5(partnership, authorities)).toBe(0.75);
    expect(requiredAuthorityRecall(partnership, authorities)).toBe(1);
    expect(passageSupport(claims)).toBe(0.5);
    expect(falseVerificationRate(claims)).toBe(1);
    expect(domainContaminationRate(partnership, authorities)).toBe(0.25);
    expect(sourceAvailability(authorities)).toBe(0.75);
    expect(
      sourceAvailability([], [
        { status: 'searched' },
        { status: 'error' },
      ]),
    ).toBe(0.5);
  });

  it('requires both current and legacy law context for a transition answer', () => {
    expect(
      currentLawQualification(
        transition,
        'Bharatiya Sakshya Adhiniyam section 63 now governs electronic records.',
      ),
    ).toBe(0);
    expect(
      currentLawQualification(
        transition,
        'Bharatiya Sakshya Adhiniyam section 63 replaced the Evidence Act section 65B framework from 1 July 2024.',
      ),
    ).toBe(1);
  });

  it('scores foundation counts and confidence calibration deterministically', () => {
    expect(countScore({ passed: 3, total: 4 })).toBe(0.75);
    expect(countScore({ passed: 0, total: 0 })).toBe(1);
    expect(
      confidenceCalibration([
        { confidence: 0.9, correct: true },
        { confidence: 0.2, correct: false },
      ]),
    ).toBe(0.975);
  });

  it('passes a supported partnership observation and reports failing dimensions', () => {
    const observation: IndiaResearchLiveObservation = {
      authorities: [
        {
          title: 'Indian Partnership Act',
          citation: 'section 69',
          domain: 'partnership',
        },
        {
          title: 'Umesh Goel v Himachal Pradesh Cooperative Group Housing Society',
          citation: '(2016) 11 SCC 313',
          domain: 'partnership arbitration',
        },
      ],
      claims: [
        { expectedSupported: true, passageSupported: true, verified: true },
      ],
      answerMarkdown:
        'Section 69(3)(a) preserves proceedings for dissolution, accounts, and realization of partnership property.',
      abstained: false,
      firstDraftMs: 10_000,
      totalMs: 20_000,
    };

    expect(scoreIndiaResearchBenchmark(partnership, observation)).toMatchObject({
      passed: true,
      failures: [],
      precisionAt5: 1,
      requiredAuthorityRecall: 1,
      passageSupport: 1,
      falseVerificationRate: 0,
    });

    const failing = scoreIndiaResearchBenchmark(partnership, {
      ...observation,
      authorities: [],
      claims: [
        { expectedSupported: true, passageSupported: false, verified: false },
      ],
      firstDraftMs: null,
      totalMs: 100_000,
    });
    expect(failing.passed).toBe(false);
    expect(failing.failures).toEqual(
      expect.arrayContaining([
        'precisionAt5',
        'requiredAuthorityRecall',
        'passageSupport',
        'sourceAvailability',
        'firstDraftMs',
        'totalMs',
      ]),
    );
  });

  it('reports adversarial foundation failures without treating missing telemetry as success', () => {
    const base: IndiaResearchLiveObservation = {
      authorities: [
        {
          title: 'Indian Partnership Act',
          citation: 'section 69',
          domain: 'partnership',
        },
        {
          title: 'Umesh Goel v Himachal Pradesh Cooperative Group Housing Society',
          citation: '(2016) 11 SCC 313',
          domain: 'partnership arbitration',
        },
      ],
      claims: [
        { expectedSupported: true, passageSupported: true, verified: true },
      ],
      answerMarkdown: 'Section 69(3)(a) applies.',
      firstDraftMs: 1_000,
      totalMs: 2_000,
    };

    const legacyCompatible = scoreIndiaResearchBenchmark(partnership, base);
    expect(legacyCompatible.planCorrectness).toBeNull();
    expect(legacyCompatible.failures).not.toContain('planCorrectness');

    const measured = scoreIndiaResearchBenchmark(partnership, {
      ...base,
      foundation: {
        planCorrectness: { passed: 1, total: 2 },
        issueDependencyCoverage: { passed: 1, total: 2 },
        sourceIntegrity: { passed: 1, total: 2 },
        contrarySearchCompletion: { passed: 0, total: 1 },
        conflictFidelity: { passed: 1, total: 1 },
        temporalFidelity: { passed: 1, total: 1 },
        factFidelity: { passed: 1, total: 2 },
        propositionSupport: { passed: 1, total: 2 },
        confidenceCalibration: [{ confidence: 0.95, correct: false }],
        reproducibility: { passed: 0, total: 1 },
      },
    });

    expect(measured.failures).toEqual(
      expect.arrayContaining([
        'planCorrectness',
        'issueDependencyCoverage',
        'sourceIntegrity',
        'contrarySearchCompletion',
        'factFidelity',
        'propositionSupport',
        'confidenceCalibration',
        'reproducibility',
      ]),
    );
    expect(measured.adversarialFailures).toEqual(
      expect.arrayContaining([
        'incorrect_plan',
        'missing_issue_dependency',
        'contrary_search_omission',
        'fact_fidelity_failure',
        'unsupported_proposition',
        'confidence_miscalibration',
        'non_reproducible_result',
      ]),
    );
  });

  it('rewards abstention and rejects verification of the fabricated authority', () => {
    const fake = INDIA_RESEARCH_BENCHMARK_MANIFEST.find(
      (benchmark) => benchmark.category === 'fake_citation_no_answer',
    )!;
    const result = scoreIndiaResearchBenchmark(fake, {
      authorities: [],
      claims: [
        { expectedSupported: false, passageSupported: false, verified: false },
      ],
      answerMarkdown: 'I cannot verify that citation in a reliable authority.',
      firstDraftMs: 5_000,
      totalMs: 8_000,
    });
    expect(result.abstention).toBe(1);
    expect(result.falseVerificationRate).toBe(0);
    expect(result.passed).toBe(true);
  });
});

describe('India research release gate', () => {
  it('blocks a release for a single false HIGH classification', () => {
    const gate = evaluateIndiaResearchReleaseGate([], [
      { confidence: 0.95, correct: true },
      { confidence: 0.91, correct: false },
      { confidence: 0.6, correct: false },
    ]);

    expect(gate.passed).toBe(false);
    expect(gate.falseHighCount).toBe(1);
    expect(gate.highConfidencePrecision).toBe(0.5);
  });
});
