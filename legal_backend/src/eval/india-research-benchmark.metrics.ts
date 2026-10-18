import type {
  IndiaResearchAdversarialFailureCategory,
  IndiaResearchBenchmarkCase,
} from './india-research-benchmark.manifest';

export interface RankedResearchAuthority {
  key?: string | null;
  title?: string | null;
  citation?: string | null;
  domain?: string | null;
  relevant?: boolean;
  sourceAvailable?: boolean;
}

export interface ResearchClaimObservation {
  expectedSupported: boolean;
  passageSupported: boolean;
  verified: boolean;
}

export interface BenchmarkCountObservation {
  passed: number;
  total: number;
}

export interface ResearchConfidenceObservation {
  confidence: number;
  correct: boolean;
}

export interface IndiaResearchFoundationObservations {
  planCorrectness?: BenchmarkCountObservation;
  issueDependencyCoverage?: BenchmarkCountObservation;
  sourceIntegrity?: BenchmarkCountObservation;
  contrarySearchCompletion?: BenchmarkCountObservation;
  conflictFidelity?: BenchmarkCountObservation;
  temporalFidelity?: BenchmarkCountObservation;
  factFidelity?: BenchmarkCountObservation;
  propositionSupport?: BenchmarkCountObservation;
  confidenceCalibration?: readonly ResearchConfidenceObservation[];
  reproducibility?: BenchmarkCountObservation;
}

export interface IndiaResearchLiveObservation {
  authorities: readonly RankedResearchAuthority[];
  claims: readonly ResearchClaimObservation[];
  answerMarkdown: string;
  abstained?: boolean;
  firstDraftMs: number | null;
  totalMs: number;
  sourceDiagnostics?: ReadonlyArray<{ status?: string | null }>;
  caseLawSearchStatus?: string | null;
  foundation?: IndiaResearchFoundationObservations;
}

export interface IndiaResearchBenchmarkMetrics {
  precisionAt5: number;
  requiredAuthorityRecall: number;
  passageSupport: number;
  currentLawQualification: number | null;
  falseVerificationRate: number;
  domainContaminationRate: number;
  abstention: number | null;
  sourceAvailability: number;
  planCorrectness: number | null;
  issueDependencyCoverage: number | null;
  sourceIntegrity: number | null;
  contrarySearchCompletion: number | null;
  conflictFidelity: number | null;
  temporalFidelity: number | null;
  factFidelity: number | null;
  propositionSupport: number;
  confidenceCalibration: number | null;
  reproducibility: number | null;
  firstDraftMs: number | null;
  totalMs: number;
  passed: boolean;
  failures: string[];
  adversarialFailures: IndiaResearchAdversarialFailureCategory[];
}

export interface IndiaResearchReleaseGate {
  passed: boolean;
  falseHighCount: number;
  highConfidencePrecision: number | null;
  failedBenchmarks: number;
  reasons: string[];
}

/**
 * Release gate is intentionally asymmetric: one false HIGH blocks release,
 * while conservative PARTIAL/GAP outcomes are permitted.
 */
export function evaluateIndiaResearchReleaseGate(
  metrics: readonly IndiaResearchBenchmarkMetrics[],
  confidenceObservations: readonly ResearchConfidenceObservation[] = [],
): IndiaResearchReleaseGate {
  const high = confidenceObservations.filter((observation) => observation.confidence >= 0.9);
  const falseHighCount = high.filter((observation) => !observation.correct).length;
  const highConfidencePrecision =
    high.length === 0 ? null : round((high.length - falseHighCount) / high.length);
  const failedBenchmarks = metrics.filter((metric) => !metric.passed).length;
  const reasons = [
    ...(falseHighCount > 0
      ? [`${falseHighCount} HIGH-confidence result${falseHighCount === 1 ? '' : 's'} failed expert review.`]
      : []),
    ...(failedBenchmarks > 0
      ? [`${failedBenchmarks} benchmark${failedBenchmarks === 1 ? '' : 's'} failed required task contracts.`]
      : []),
    ...(metrics.some((metric) => metric.falseVerificationRate > 0)
      ? ['False verification rate must be zero before release.']
      : []),
  ];
  return {
    passed: reasons.length === 0,
    falseHighCount,
    highConfidencePrecision,
    failedBenchmarks,
    reasons,
  };
}

export function countScore(
  observation: BenchmarkCountObservation | undefined,
): number | null {
  if (!observation) return null;
  if (
    !Number.isFinite(observation.passed) ||
    !Number.isFinite(observation.total) ||
    observation.passed < 0 ||
    observation.total < 0 ||
    observation.passed > observation.total
  ) {
    throw new Error('Benchmark counts must satisfy 0 <= passed <= total');
  }
  return observation.total === 0 ? 1 : round(observation.passed / observation.total);
}

export function confidenceCalibration(
  observations: readonly ResearchConfidenceObservation[] | undefined,
): number | null {
  if (!observations) return null;
  if (observations.length === 0) return 1;
  const brier = observations.reduce((sum, observation) => {
    if (
      !Number.isFinite(observation.confidence) ||
      observation.confidence < 0 ||
      observation.confidence > 1
    ) {
      throw new Error('Benchmark confidence must be between 0 and 1');
    }
    return sum + (observation.confidence - (observation.correct ? 1 : 0)) ** 2;
  }, 0) / observations.length;
  return round(1 - brier);
}

function round(value: number): number {
  return Number(value.toFixed(4));
}

function normalize(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function authorityText(authority: RankedResearchAuthority): string {
  return normalize([authority.key, authority.title, authority.citation].filter(Boolean).join(' '));
}

function matchesAliases(
  authority: RankedResearchAuthority,
  aliases: readonly string[],
): boolean {
  const candidate = authorityText(authority);
  if (!candidate) return false;
  return aliases.some((alias) => {
    const expected = normalize(alias);
    if (!expected) return false;
    const candidateTokens = new Set(candidate.split(' '));
    const tokenMatch = expected
      .split(' ')
      .every((token) => candidateTokens.has(token));
    return candidate.includes(expected) || expected.includes(candidate) || tokenMatch;
  });
}

function inferredRelevant(
  benchmark: IndiaResearchBenchmarkCase,
  authority: RankedResearchAuthority,
): boolean {
  if (authority.relevant !== undefined) return authority.relevant;
  return [...benchmark.requiredAuthorities, ...benchmark.relevantAuthorities].some(
    (expected) => matchesAliases(authority, expected.aliases),
  );
}

export function precisionAt5(
  benchmark: IndiaResearchBenchmarkCase,
  authorities: readonly RankedResearchAuthority[],
): number {
  const topFive = authorities.slice(0, 5);
  if (topFive.length === 0) return benchmark.shouldAbstain ? 1 : 0;
  return round(
    topFive.filter((authority) => inferredRelevant(benchmark, authority)).length /
      topFive.length,
  );
}

export function requiredAuthorityRecall(
  benchmark: IndiaResearchBenchmarkCase,
  authorities: readonly RankedResearchAuthority[],
): number {
  if (benchmark.requiredAuthorities.length === 0) return 1;
  const found = benchmark.requiredAuthorities.filter((expected) =>
    authorities.some((authority) => matchesAliases(authority, expected.aliases)),
  ).length;
  return round(found / benchmark.requiredAuthorities.length);
}

export function passageSupport(
  claims: readonly ResearchClaimObservation[],
): number {
  const expectedClaims = claims.filter((claim) => claim.expectedSupported);
  if (expectedClaims.length === 0) return 1;
  return round(
    expectedClaims.filter((claim) => claim.passageSupported).length /
      expectedClaims.length,
  );
}

export function propositionSupport(
  claims: readonly ResearchClaimObservation[],
  observation?: BenchmarkCountObservation,
): number {
  return countScore(observation) ?? passageSupport(claims);
}

export function currentLawQualification(
  benchmark: IndiaResearchBenchmarkCase,
  answerMarkdown: string,
): number | null {
  if (!benchmark.currentLawTerms?.length) return null;
  const answer = normalize(answerMarkdown);
  const mentionsCurrent = benchmark.currentLawTerms.some((term) =>
    answer.includes(normalize(term)),
  );
  const mentionsLegacy =
    !benchmark.legacyLawTerms?.length ||
    benchmark.legacyLawTerms.some((term) => answer.includes(normalize(term)));
  return mentionsCurrent && mentionsLegacy ? 1 : 0;
}

export function falseVerificationRate(
  claims: readonly ResearchClaimObservation[],
): number {
  const unsupported = claims.filter((claim) => !claim.expectedSupported);
  if (unsupported.length === 0) return 0;
  return round(
    unsupported.filter((claim) => claim.verified).length / unsupported.length,
  );
}

export function domainContaminationRate(
  benchmark: IndiaResearchBenchmarkCase,
  authorities: readonly RankedResearchAuthority[],
): number {
  const topFive = authorities.slice(0, 5);
  const withDomain = topFive.filter((authority) => normalize(authority.domain));
  if (withDomain.length === 0) return 0;
  const expectedDomains = benchmark.expectedDomains.map(normalize);
  const contaminated = withDomain.filter((authority) => {
    const domain = normalize(authority.domain);
    return !expectedDomains.some(
      (expected) => domain.includes(expected) || expected.includes(domain),
    );
  }).length;
  return round(contaminated / withDomain.length);
}

export function abstentionScore(
  benchmark: IndiaResearchBenchmarkCase,
  observation: Pick<IndiaResearchLiveObservation, 'abstained' | 'answerMarkdown'>,
): number | null {
  if (!benchmark.shouldAbstain) return null;
  const explicitAbstention =
    observation.abstained ??
    /\b(unable|cannot|could not)\s+(?:independently\s+)?verify\b|\bcannot responsibly provide\b|\bno (?:directly relevant case|reliable authority)\b|\binsufficient (?:evidence|information)\b|\bauthority identity (?:was )?not established\b/i.test(
      observation.answerMarkdown,
    );
  return explicitAbstention ? 1 : 0;
}

export function sourceAvailability(
  authorities: readonly RankedResearchAuthority[],
  diagnostics: ReadonlyArray<{ status?: string | null }> = [],
  caseLawSearchStatus?: string | null,
): number {
  if (diagnostics.length > 0) {
    const available = diagnostics.filter(({ status }) =>
      ['searched', 'no_hits'].includes(normalize(status)),
    ).length;
    return round(available / diagnostics.length);
  }
  if (caseLawSearchStatus) {
    return ['searched', 'no_hits'].includes(normalize(caseLawSearchStatus)) ? 1 : 0;
  }
  if (authorities.length === 0) return 0;
  return round(
    authorities.filter((authority) => authority.sourceAvailable !== false).length /
      authorities.length,
  );
}

export function scoreIndiaResearchBenchmark(
  benchmark: IndiaResearchBenchmarkCase,
  observation: IndiaResearchLiveObservation,
): IndiaResearchBenchmarkMetrics {
  const foundation = observation.foundation;
  const metrics = {
    precisionAt5: precisionAt5(benchmark, observation.authorities),
    requiredAuthorityRecall: requiredAuthorityRecall(
      benchmark,
      observation.authorities,
    ),
    passageSupport: passageSupport(observation.claims),
    currentLawQualification: currentLawQualification(
      benchmark,
      observation.answerMarkdown,
    ),
    falseVerificationRate: falseVerificationRate(observation.claims),
    domainContaminationRate: domainContaminationRate(
      benchmark,
      observation.authorities,
    ),
    abstention: abstentionScore(benchmark, observation),
    sourceAvailability: sourceAvailability(
      observation.authorities,
      observation.sourceDiagnostics,
      observation.caseLawSearchStatus,
    ),
    planCorrectness: countScore(foundation?.planCorrectness),
    issueDependencyCoverage: countScore(foundation?.issueDependencyCoverage),
    sourceIntegrity: countScore(foundation?.sourceIntegrity),
    contrarySearchCompletion: countScore(foundation?.contrarySearchCompletion),
    conflictFidelity: countScore(foundation?.conflictFidelity),
    temporalFidelity: countScore(foundation?.temporalFidelity),
    factFidelity: countScore(foundation?.factFidelity),
    propositionSupport: propositionSupport(
      observation.claims,
      foundation?.propositionSupport,
    ),
    confidenceCalibration: confidenceCalibration(
      foundation?.confidenceCalibration,
    ),
    reproducibility: countScore(foundation?.reproducibility),
    firstDraftMs: observation.firstDraftMs,
    totalMs: observation.totalMs,
  };
  const failures: string[] = [];
  const { thresholds } = benchmark;

  if (metrics.precisionAt5 < thresholds.precisionAt5) failures.push('precisionAt5');
  if (metrics.requiredAuthorityRecall < thresholds.requiredAuthorityRecall) {
    failures.push('requiredAuthorityRecall');
  }
  if (metrics.passageSupport < thresholds.passageSupport) failures.push('passageSupport');
  if (metrics.currentLawQualification === 0) failures.push('currentLawQualification');
  if (metrics.falseVerificationRate > thresholds.maxFalseVerificationRate) {
    failures.push('falseVerificationRate');
  }
  if (metrics.domainContaminationRate > thresholds.maxDomainContaminationRate) {
    failures.push('domainContaminationRate');
  }
  if (metrics.abstention === 0) failures.push('abstention');
  if (metrics.sourceAvailability < thresholds.sourceAvailability) {
    failures.push('sourceAvailability');
  }
  const minimumMetrics = [
    'planCorrectness',
    'issueDependencyCoverage',
    'sourceIntegrity',
    'contrarySearchCompletion',
    'conflictFidelity',
    'temporalFidelity',
    'factFidelity',
    'propositionSupport',
    'confidenceCalibration',
    'reproducibility',
  ] as const;
  for (const metric of minimumMetrics) {
    const value = metrics[metric];
    if (value !== null && value < thresholds[metric]) failures.push(metric);
  }
  if (
    metrics.firstDraftMs === null ||
    metrics.firstDraftMs > thresholds.maxFirstDraftMs
  ) {
    failures.push('firstDraftMs');
  }
  if (metrics.totalMs > thresholds.maxTotalMs) failures.push('totalMs');

  const failureCategoryByMetric: Partial<
    Record<string, IndiaResearchAdversarialFailureCategory>
  > = {
    planCorrectness: 'incorrect_plan',
    issueDependencyCoverage: 'missing_issue_dependency',
    sourceIntegrity: 'source_integrity_failure',
    contrarySearchCompletion: 'contrary_search_omission',
    conflictFidelity: 'conflict_resolution_failure',
    currentLawQualification: 'temporal_fidelity_failure',
    temporalFidelity: 'temporal_fidelity_failure',
    factFidelity: 'fact_fidelity_failure',
    passageSupport: 'unsupported_proposition',
    propositionSupport: 'unsupported_proposition',
    falseVerificationRate: 'unsupported_proposition',
    confidenceCalibration: 'confidence_miscalibration',
    abstention: 'failure_to_abstain',
    reproducibility: 'non_reproducible_result',
  };
  const allowedCategories = new Set(benchmark.adversarialFailureCategories);
  const adversarialFailures = [
    ...new Set(
      failures
        .map((failure) => failureCategoryByMetric[failure])
        .filter(
          (category): category is IndiaResearchAdversarialFailureCategory =>
            category !== undefined && allowedCategories.has(category),
        ),
    ),
  ];
  return {
    ...metrics,
    passed: failures.length === 0,
    failures,
    adversarialFailures,
  };
}
