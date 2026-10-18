import {
  INDIA_RESEARCH_BENCHMARK_MANIFEST,
  type IndiaResearchBenchmarkManifestCase,
} from '@/eval/india-research-benchmark.manifest';
import {
  scoreIndiaResearchBenchmark,
  type RankedResearchAuthority,
  type ResearchClaimObservation,
} from '@/eval/india-research-benchmark.metrics';

type Mode = 'FAST' | 'DEEP';

const apiUrl = (process.env.LEGAL_BENCHMARK_API_URL ?? 'http://localhost:3001').replace(/\/$/, '');
const token = process.env.LEGAL_BENCHMARK_TOKEN;
const tenantId = process.env.LEGAL_BENCHMARK_TENANT_ID;
const modes = (process.env.LEGAL_BENCHMARK_MODES ?? 'FAST,DEEP')
  .split(',')
  .map((value) => value.trim().toUpperCase())
  .filter((value): value is Mode => value === 'FAST' || value === 'DEEP');

if (!token || !tenantId) {
  throw new Error('Set LEGAL_BENCHMARK_TOKEN and LEGAL_BENCHMARK_TENANT_ID');
}

const headers = {
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
  'x-tenant-id': tenantId,
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: { ...headers, ...(init?.headers ?? {}) },
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${await response.text()}`);
  }
  return response.json() as Promise<T>;
}

function records(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter(
        (item): item is Record<string, unknown> =>
          typeof item === 'object' && item !== null,
      )
    : [];
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function liveAuthorities(result: Record<string, unknown>): RankedResearchAuthority[] {
  const evidencePack =
    typeof result.evidencePack === 'object' && result.evidencePack !== null
      ? (result.evidencePack as Record<string, unknown>)
      : {};
  const candidates = [
    ...records(result.authorities),
    ...records(result.sources),
    ...records(result.citations),
    ...records(evidencePack.authorities),
  ];
  const seen = new Set<string>();
  const authorities: RankedResearchAuthority[] = [];

  for (const candidate of candidates) {
    const nested =
      typeof candidate.authority === 'object' && candidate.authority !== null
        ? (candidate.authority as Record<string, unknown>)
        : candidate;
    const authority = {
      key: text(nested.id) ?? text(nested.key),
      title: text(nested.title) ?? text(nested.name),
      citation: text(nested.citation) ?? text(nested.neutralCitation),
      domain:
        text(nested.domain) ??
        text(nested.legalDomain) ??
        text(nested.practiceArea) ??
        text(nested.sourceTier),
      sourceAvailable:
        nested.available !== false &&
        nested.sourceAvailable !== false &&
        nested.retrievalStatus !== 'FAILED',
    };
    const identity = `${authority.key ?? ''}|${authority.title ?? ''}|${authority.citation ?? ''}`;
    if (identity === '||' || seen.has(identity)) continue;
    seen.add(identity);
    authorities.push(authority);
  }
  return authorities;
}

function liveClaims(
  testCase: IndiaResearchBenchmarkManifestCase,
  result: Record<string, unknown>,
  audit: Record<string, unknown>,
): ResearchClaimObservation[] {
  const claimAudits = [
    ...records(result.claimAudits),
    ...records(audit.claimAudits),
  ];
  if (claimAudits.length === 0 && testCase.shouldAbstain) {
    return [
      {
        expectedSupported: false,
        passageSupported: false,
        verified: audit.safeForReliance === true,
      },
    ];
  }
  return claimAudits.map((claim) => ({
    expectedSupported: !testCase.shouldAbstain,
    passageSupported:
      claim.passageSupport === 'SUPPORTED' ||
      claim.passageSupport === 'PASS' ||
      claim.passageSupported === true,
    verified:
      claim.verified === true ||
      (claim.passageSupport === 'SUPPORTED' && claim.action === 'KEEP'),
  }));
}

async function runCase(testCase: IndiaResearchBenchmarkManifestCase, mode: Mode) {
  const startedAt = Date.now();
  const { jobId } = await request<{ jobId: string }>('/ai/research/async', {
    method: 'POST',
    body: JSON.stringify({
      query: testCase.query,
      countryCode: 'IN',
      researchMode: mode,
    }),
  });

  let firstDraftMs: number | null = null;
  for (;;) {
    const job = await request<{
      status: string;
      error?: string;
      result?: Record<string, unknown>;
    }>(`/agents/jobs/${jobId}`);
    const markdown =
      typeof job.result?.draftMarkdown === 'string'
        ? job.result.draftMarkdown
        : typeof job.result?.outputMarkdown === 'string'
          ? job.result.outputMarkdown
          : '';
    if (markdown && firstDraftMs === null) firstDraftMs = Date.now() - startedAt;
    if (job.status === 'FAILED') throw new Error(job.error ?? `Benchmark ${testCase.id} failed`);
    if (job.status === 'COMPLETED') {
      const audit = (job.result?.citationAudit ?? {}) as Record<string, unknown>;
      const findings = Array.isArray(job.result?.findings)
        ? (job.result.findings as Array<Record<string, unknown>>)
        : [];
      const completedAt = Date.now();
      const totalMs = completedAt - startedAt;
      const authorities = liveAuthorities(job.result ?? {});
      const claims = liveClaims(testCase, job.result ?? {}, audit);
      const sourceDiagnostics = [
        ...(Array.isArray(job.result?.sourceDiagnostics)
          ? (job.result.sourceDiagnostics as Array<{ status?: string }>)
          : []),
        ...(Array.isArray(job.result?.connectorDiagnostics)
          ? (job.result.connectorDiagnostics as Array<{ status?: string }>)
          : []),
      ];
      const benchmarkMetrics = scoreIndiaResearchBenchmark(testCase, {
        authorities,
        claims,
        answerMarkdown: markdown,
        firstDraftMs,
        totalMs,
        sourceDiagnostics,
        caseLawSearchStatus:
          typeof job.result?.caseLawSearchStatus === 'string'
            ? job.result.caseLawSearchStatus
            : null,
      });
      return {
        id: testCase.id,
        category: testCase.category,
        mode,
        firstDraftMs,
        totalMs,
        safeForReliance: audit.safeForReliance === true,
        citationCount: Number(audit.citationCount ?? 0),
        unsupportedBlockers: findings.filter(
          (finding) =>
            finding.severity === 'BLOCKER' &&
            finding.state !== 'PASS' &&
            (finding.dimension === 'passage' || finding.dimension === 'identity'),
        ).length,
        metrics: benchmarkMetrics,
      };
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
}

function percentile(values: number[], percentileValue: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil((percentileValue / 100) * sorted.length) - 1] ?? null;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Number(
    (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(4),
  );
}

async function main() {
  const results = [];
  for (const mode of modes) {
    for (const testCase of INDIA_RESEARCH_BENCHMARK_MANIFEST) {
      results.push(await runCase(testCase, mode));
    }
  }
  const draftLatencies = results
    .map((result) => result.firstDraftMs)
    .filter((value): value is number => value !== null);
  const totals = results.map((result) => result.totalMs);
  const summary = {
    generatedAt: new Date().toISOString(),
    targets: { p95DraftMs: 45_000, p95TotalMs: 90_000 },
    p50DraftMs: percentile(draftLatencies, 50),
    p95DraftMs: percentile(draftLatencies, 95),
    p50TotalMs: percentile(totals, 50),
    p95TotalMs: percentile(totals, 95),
    safeForRelianceRate:
      results.filter((result) => result.safeForReliance).length / Math.max(1, results.length),
    unsupportedBlockerCount: results.reduce(
      (sum, result) => sum + result.unsupportedBlockers,
      0,
    ),
    benchmarkPassRate:
      results.filter((result) => result.metrics.passed).length /
      Math.max(1, results.length),
    metrics: {
      precisionAt5: average(results.map((result) => result.metrics.precisionAt5)),
      requiredAuthorityRecall: average(
        results.map((result) => result.metrics.requiredAuthorityRecall),
      ),
      passageSupport: average(
        results.map((result) => result.metrics.passageSupport),
      ),
      currentLawQualification: average(
        results
          .map((result) => result.metrics.currentLawQualification)
          .filter((value): value is number => value !== null),
      ),
      falseVerificationRate: average(
        results.map((result) => result.metrics.falseVerificationRate),
      ),
      domainContaminationRate: average(
        results.map((result) => result.metrics.domainContaminationRate),
      ),
      abstention: average(
        results
          .map((result) => result.metrics.abstention)
          .filter((value): value is number => value !== null),
      ),
      sourceAvailability: average(
        results.map((result) => result.metrics.sourceAvailability),
      ),
      planCorrectness: average(
        results
          .map((result) => result.metrics.planCorrectness)
          .filter((value): value is number => value !== null),
      ),
      issueDependencyCoverage: average(
        results
          .map((result) => result.metrics.issueDependencyCoverage)
          .filter((value): value is number => value !== null),
      ),
      sourceIntegrity: average(
        results
          .map((result) => result.metrics.sourceIntegrity)
          .filter((value): value is number => value !== null),
      ),
      contrarySearchCompletion: average(
        results
          .map((result) => result.metrics.contrarySearchCompletion)
          .filter((value): value is number => value !== null),
      ),
      conflictFidelity: average(
        results
          .map((result) => result.metrics.conflictFidelity)
          .filter((value): value is number => value !== null),
      ),
      temporalFidelity: average(
        results
          .map((result) => result.metrics.temporalFidelity)
          .filter((value): value is number => value !== null),
      ),
      factFidelity: average(
        results
          .map((result) => result.metrics.factFidelity)
          .filter((value): value is number => value !== null),
      ),
      propositionSupport: average(
        results.map((result) => result.metrics.propositionSupport),
      ),
      confidenceCalibration: average(
        results
          .map((result) => result.metrics.confidenceCalibration)
          .filter((value): value is number => value !== null),
      ),
      reproducibility: average(
        results
          .map((result) => result.metrics.reproducibility)
          .filter((value): value is number => value !== null),
      ),
    },
    results,
  };
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  if (
    (summary.p95DraftMs ?? Number.POSITIVE_INFINITY) > summary.targets.p95DraftMs ||
    (summary.p95TotalMs ?? Number.POSITIVE_INFINITY) > summary.targets.p95TotalMs ||
    summary.unsupportedBlockerCount > 0 ||
    summary.benchmarkPassRate < 1
  ) {
    process.exitCode = 1;
  }
}

void main();
