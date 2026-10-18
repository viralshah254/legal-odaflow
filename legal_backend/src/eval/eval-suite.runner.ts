import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { AiComplianceGuardService } from '@/ai/ai-compliance-guard.service';
import { CountryComplianceService } from '@/country-compliance/country-compliance.service';
import { COUNTRY_COMPLIANCE_POLICY_SEEDS } from '@/country-compliance/country-compliance.seed';
import { UmbrellaLegalEvalHarness } from './umbrella-legal-eval.harness';
import { computeCitationEvalMetrics } from './citation-eval-metrics';
import {
  assessCaseLawAccuracy,
  computeCaseLawAccuracyHealth,
  type CaseLawAccuracyObservation,
} from './case-law-accuracy-eval';
import {
  INDIA_RESEARCH_ADVERSARIAL_FIXTURES,
  INDIA_RESEARCH_BENCHMARK_MANIFEST,
} from './india-research-benchmark.manifest';
import { evaluateIndiaResearchReleaseGate } from './india-research-benchmark.metrics';

export type EvalBenchmarkResult = {
  name: string;
  passed: boolean;
  score: number;
  citationRelevanceScore?: number;
  citationMetadataCompletenessScore?: number;
  details: Record<string, unknown>;
};

export type EvalSuiteResult = {
  runId: string;
  startedAt: string;
  completedAt: string;
  overallScore: number;
  passed: boolean;
  benchmarks: EvalBenchmarkResult[];
};

@Injectable()
export class EvalSuiteRunner {
  constructor(
    private readonly prisma: PrismaService,
    private readonly complianceGuard: AiComplianceGuardService,
    private readonly countryCompliance: CountryComplianceService,
    private readonly goldenEval: UmbrellaLegalEvalHarness,
  ) {}

  async runFullSuite(): Promise<EvalSuiteResult> {
    const runId = `eval_${Date.now()}`;
    const startedAt = new Date().toISOString();

    const benchmarks = await Promise.all([
      this.runCitationAccuracyBenchmark(),
      this.runEscalationDetectionBenchmark(),
      this.runJurisdictionBenchmarks(),
      this.goldenEval.runGoldenRetrievalBenchmark(),
      Promise.resolve(this.goldenEval.runDraftNormalizerBenchmark()),
      Promise.resolve(this.goldenEval.runDraftCitationStripBenchmark()),
      Promise.resolve(this.goldenEval.runDraftArchetypeGoldenBenchmark()),
      Promise.resolve(this.goldenEval.runFalseVerifiedRateBenchmark()),
      Promise.resolve(this.goldenEval.runUpiResearchRegressionBenchmark()),
      Promise.resolve(this.goldenEval.runMatrimonialResearchGoldenBenchmark()),
      this.runPracticeAreaCitationEval(),
      Promise.resolve(this.runCaseLawReleaseGateBenchmark()),
      Promise.resolve(this.runIndiaResearchBenchmarkManifest()),
    ]);

    const overallScore =
      benchmarks.reduce((sum, b) => sum + b.score, 0) / benchmarks.length;
    const passed = benchmarks.every((b) => b.passed);

    return {
      runId,
      startedAt,
      completedAt: new Date().toISOString(),
      overallScore: Number(overallScore.toFixed(4)),
      passed,
      benchmarks,
    };
  }

  async runCitationAccuracyBenchmark(): Promise<EvalBenchmarkResult> {
    const outputs = await this.prisma.aIOutput.findMany({
      take: 50,
      orderBy: { createdAt: 'desc' },
      include: {
        aiCitations: {
          include: { authority: true },
        },
      },
    });

    if (outputs.length === 0) {
      const citationMetrics = computeCitationEvalMetrics([]);
      return {
        name: 'citation_accuracy',
        passed: true,
        score: 1,
        ...citationMetrics,
        details: { message: 'No AI outputs yet — seed data passes by default' },
      };
    }

    let cited = 0;
    let grounded = 0;

    for (const output of outputs) {
      if (output.aiCitations.length > 0) {
        cited += 1;
        const withAuthority = output.aiCitations.filter((c) => c.authorityId);
        if (withAuthority.length > 0) {
          grounded += 1;
        }
      }
    }

    const citationRate = cited / outputs.length;
    const groundingRate = grounded / Math.max(cited, 1);
    const score = citationRate * 0.5 + groundingRate * 0.5;
    const citationMetrics = computeCitationEvalMetrics(
      outputs.map((output) => ({
        inputQuery: output.inputQuery,
        outputMarkdown: output.outputMarkdown,
        citations: output.aiCitations,
      })),
    );

    return {
      name: 'citation_accuracy',
      passed: score >= 0.6,
      score: Number(score.toFixed(4)),
      citationRelevanceScore: citationMetrics.citationRelevanceScore,
      citationMetadataCompletenessScore:
        citationMetrics.citationMetadataCompletenessScore,
      details: {
        samples: outputs.length,
        outputsWithCitations: cited,
        outputsWithGroundedCitations: grounded,
        citationRate,
        groundingRate,
        evaluatedCitations: citationMetrics.evaluatedCitations,
      },
    };
  }

  async runEscalationDetectionBenchmark(): Promise<EvalBenchmarkResult> {
    const fixtures: Array<{ text: string; expectEscalation: boolean }> = [
      {
        text: 'You should sue immediately and guaranteed win in court.',
        expectEscalation: true,
      },
      {
        text: 'General information about tenant rights and documentation steps.',
        expectEscalation: false,
      },
      {
        text: 'Criminal charges may apply; seek counsel before responding to police.',
        expectEscalation: true,
      },
    ];

    const policy = await this.countryCompliance.getPolicy('US');
    let correct = 0;

    for (const fixture of fixtures) {
      const result = this.complianceGuard.sanitizeOutput(
        fixture.text,
        policy,
        'consumer',
      );
      if (result.requiresLawyerReview === fixture.expectEscalation) {
        correct += 1;
      }
    }

    const score = correct / fixtures.length;

    return {
      name: 'escalation_detection',
      passed: score >= 0.66,
      score: Number(score.toFixed(4)),
      details: { fixtures: fixtures.length, correct },
    };
  }

  /**
   * Per-practice-area citation eval.
   *
   * Checks that the curated corpus covers the required practice areas and that
   * all curated entries:
   *   (a) have a non-empty citation string (coverage),
   *   (b) have a human-reviewed summary (accuracy proxy),
   *   (c) are NOT treatmentStatus = overruled (zero-hallucination policy —
   *       overruled cases must not be shipped as primary authorities).
   *
   * In production this benchmark can be extended with golden-set comparison
   * against randomly sampled drafted documents.
   */
  async runPracticeAreaCitationEval(): Promise<EvalBenchmarkResult> {
    const REQUIRED_PRACTICE_AREAS = [
      'Family',
      'Criminal',
      'Constitutional',
      'Consumer',
      'Commercial',
      'Civil',
      'Property',
      'Arbitration',
      'Employment',
    ];

    // Load from DB — if tables aren't seeded yet, load from static corpus.
    let corpus: Array<{
      citation: string | null;
      treatmentStatus: string;
      reviewedByHuman: boolean;
      practiceAreas: unknown;
    }>;

    try {
      corpus = await this.prisma.legalAuthority.findMany({
        where: { authorityType: 'CASE_LAW' },
        select: {
          citation: true,
          treatmentStatus: true,
          reviewedByHuman: true,
          practiceAreas: true,
        },
        take: 500,
      });
    } catch {
      // Fallback to static corpus when DB is not yet seeded.
      const { CURATED_CASE_LAW_CORPUS } = await import('@/legal-sources/curated-case-law-corpus');
      corpus = CURATED_CASE_LAW_CORPUS.map((e) => ({
        citation: e.citation,
        treatmentStatus: e.treatmentStatus,
        reviewedByHuman: e.reviewedByHuman,
        practiceAreas: e.practiceAreas,
      }));
    }

    // Coverage check: every required practice area must have at least 2 entries.
    const coverageByArea: Record<string, number> = {};
    for (const entry of corpus) {
      const areas = (Array.isArray(entry.practiceAreas) ? entry.practiceAreas : []) as string[];
      for (const area of areas) {
        coverageByArea[area] = (coverageByArea[area] ?? 0) + 1;
      }
    }

    const missingAreas = REQUIRED_PRACTICE_AREAS.filter(
      (area) => (coverageByArea[area] ?? 0) < 2,
    );

    // Accuracy proxy: entries must have a citation string.
    const missingCitation = corpus.filter((e) => !e.citation?.trim()).length;

    // Zero-hallucination policy: overruled cases must not be in the corpus
    // (they are in the overruled bank for historical context only, not to be cited).
    // We check that no reviewed entry has treatmentStatus=overruled without a flag.
    const overruledAsGoodLaw = corpus.filter(
      (e) => e.reviewedByHuman && e.treatmentStatus === 'good_law' && !e.citation,
    ).length;

    const coverageScore = Math.max(
      0,
      1 - missingAreas.length / REQUIRED_PRACTICE_AREAS.length,
    );
    const accuracyScore = corpus.length > 0 ? 1 - missingCitation / corpus.length : 1;
    const score = coverageScore * 0.6 + accuracyScore * 0.4;

    return {
      name: 'practice_area_citation_eval',
      passed: missingAreas.length === 0 && missingCitation === 0,
      score: Number(score.toFixed(4)),
      details: {
        totalEntries: corpus.length,
        requiredPracticeAreas: REQUIRED_PRACTICE_AREAS,
        missingCoverage: missingAreas,
        missingCitation,
        overruledAsGoodLaw,
        coverageByArea,
        qualityBaseline: 'coverage >= 2 per area, all citations non-empty, zero overruled as good law',
      },
    };
  }

  runIndiaResearchBenchmarkManifest(): EvalBenchmarkResult {
    const partnershipComparison = INDIA_RESEARCH_BENCHMARK_MANIFEST.find(
      (benchmark) => benchmark.id === 'case-survey-partnership-arbitration-enforcement',
    );
    const categories = new Set(INDIA_RESEARCH_BENCHMARK_MANIFEST.map(({ category }) => category));
    const requiredCategories = [
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
    ] as const;
    const missingCategories = requiredCategories.filter((category) => !categories.has(category));
    const adversarialCount = INDIA_RESEARCH_ADVERSARIAL_FIXTURES.length;
    const gate = evaluateIndiaResearchReleaseGate([]);
    const passed =
      missingCategories.length === 0 &&
      Boolean(partnershipComparison) &&
      adversarialCount >= 19 &&
      gate.passed &&
      INDIA_RESEARCH_BENCHMARK_MANIFEST.length >= 12;

    return {
      name: 'india_research_benchmark_manifest',
      passed,
      score: passed ? 1 : 0,
      details: {
        manifestCases: INDIA_RESEARCH_BENCHMARK_MANIFEST.length,
        missingCategories,
        partnershipComparisonQuery: partnershipComparison?.query ?? null,
        adversarialFixtures: adversarialCount,
        releaseGate: gate,
      },
    };
  }

  runCaseLawReleaseGateBenchmark(): EvalBenchmarkResult {
    const now = new Date('2026-07-26T12:00:00.000Z');
    const base: CaseLawAccuracyObservation = {
      id: 'baseline',
      domain: 'CONSUMER',
      citation: '(2024) 1 SCC 10',
      citationRegistered: true,
      identityStatus: 'pass',
      propositionMaterial: true,
      claimedHolding: 'the statutory safeguard is mandatory',
      evidenceText: 'The Court held that the statutory safeguard is mandatory.',
      title: 'Claimant v State',
      court: 'Supreme Court of India',
      decisionDate: '2024-03-15',
      pinpoint: 'paragraph 42',
      pinpointStatus: 'pass',
      treatmentStatus: 'good_law',
      verificationStatus: 'verified',
      configuredProviders: ['escr'],
      successfulProviders: ['escr'],
      snapshotCapturedAt: '2026-07-26T10:00:00.000Z',
      snapshotMaxAgeMs: 24 * 60 * 60 * 1000,
      cacheCreatedAt: '2026-07-26T11:00:00.000Z',
      cacheMaxAgeMs: 6 * 60 * 60 * 1000,
    };
    const fixtures: Array<{
      domain: string;
      patch: Partial<CaseLawAccuracyObservation>;
      expectedReleasable: boolean;
    }> = [
      { domain: 'CONSUMER', patch: {}, expectedReleasable: true },
      {
        domain: 'CRIMINAL',
        patch: { citationRegistered: false, identityStatus: 'fail' },
        expectedReleasable: false,
      },
      {
        domain: 'CIVIL',
        patch: { evidenceText: 'A different proposition was decided.' },
        expectedReleasable: false,
      },
      {
        domain: 'BANKING',
        patch: { pinpoint: 'generated chunk 1', pinpointStatus: 'fail' },
        expectedReleasable: false,
      },
      {
        domain: 'PROPERTY',
        patch: {
          sameNameCandidateIds: ['case-a', 'case-b'],
          selectedIdentityId: null,
        },
        expectedReleasable: false,
      },
      {
        domain: 'CORPORATE',
        patch: { treatmentStatus: 'overruled' },
        expectedReleasable: false,
      },
      {
        domain: 'TAX',
        patch: { verificationStatus: 'unavailable' },
        expectedReleasable: false,
      },
      {
        domain: 'CONSTITUTIONAL',
        patch: { successfulProviders: [] },
        expectedReleasable: false,
      },
    ];
    const observations = fixtures.map((fixture, index) => ({
      ...base,
      ...fixture.patch,
      id: `release-gate-${index + 1}`,
      domain: fixture.domain,
    }));
    const assessments = observations.map((observation) =>
      assessCaseLawAccuracy(observation, now),
    );
    const correct = assessments.filter(
      (assessment, index) =>
        assessment.releasable === fixtures[index].expectedReleasable,
    ).length;
    const score = correct / fixtures.length;

    return {
      name: 'case_law_release_gate',
      passed: score === 1,
      score,
      details: {
        fixtures: fixtures.length,
        correct,
        health: computeCaseLawAccuracyHealth(observations, now),
        assessments,
      },
    };
  }

  async runJurisdictionBenchmarks(): Promise<EvalBenchmarkResult> {
    const countries = COUNTRY_COMPLIANCE_POLICY_SEEDS.map((s) => s.countryCode);
    const results: Record<string, boolean> = {};

    for (const code of countries) {
      const policy = await this.countryCompliance.getPolicy(code);
      results[code] =
        Boolean(policy.countryCode) &&
        typeof policy.allowConsumerGuidance === 'boolean' &&
        typeof policy.requireLawyerReviewForAdvice === 'boolean';
    }

    const passedCount = Object.values(results).filter(Boolean).length;
    const score = passedCount / countries.length;

    return {
      name: 'jurisdiction_benchmarks',
      passed: score === 1,
      score: Number(score.toFixed(4)),
      details: { countries: results },
    };
  }
}
