import { AdminAiObservabilityService } from './admin-ai-observability.service';
import { parseRunTelemetry } from './admin-ai-observability.util';

type Row = { telemetry: unknown; latencyMs: number | null };

function service(rows: Row[]) {
  const prisma = {
    aIUsageLog: { findMany: jest.fn().mockResolvedValue(rows) },
  };
  return new AdminAiObservabilityService(prisma as never);
}

function researchRun(overrides: Record<string, unknown> = {}) {
  return {
    telemetry: {
      flow: 'research',
      countryCode: 'IN',
      taskKind: 'PROCEDURE',
      authoritiesRetrieved: 6,
      authoritiesAfterPack: 4,
      citationsStripped: 0,
      verificationStatus: 'verified',
      llmVerifierRan: true,
      requiresLawyerReview: false,
      connectorHealth: [{ source: 'indiankanoon', status: 'ok' }],
      routedModel: 'gpt-5.6-terra',
      actualModel: 'gpt-5.6-terra',
      modelFellBack: false,
      durationMs: 20_000,
      ...overrides,
    },
    latencyMs: 20_000,
  };
}

describe('parseRunTelemetry', () => {
  it('ignores anything that is not a telemetry object', () => {
    expect(parseRunTelemetry(null)).toBeNull();
    expect(parseRunTelemetry('not-json')).toBeNull();
    expect(parseRunTelemetry([1, 2, 3])).toBeNull();
  });

  it('drops fields of the wrong type rather than trusting the stored blob', () => {
    const parsed = parseRunTelemetry({
      countryCode: 42,
      authoritiesRetrieved: 'many',
      llmVerifierRan: 'yes',
      connectorHealth: [null, { source: 'tavily', status: 'error' }],
    });

    expect(parsed?.countryCode).toBeUndefined();
    expect(parsed?.authoritiesRetrieved).toBeUndefined();
    expect(parsed?.llmVerifierRan).toBeUndefined();
    expect(parsed?.connectorHealth).toEqual([{ source: 'tavily', status: 'error' }]);
  });

  it('reads a drafting run\'s certification label as its verification status', () => {
    const parsed = parseRunTelemetry({
      flow: 'drafting',
      countryCode: 'GB',
      certificationLabel: 'LAWYER_REVIEW_REQUIRED',
      lawyerReady: false,
    });

    expect(parsed?.flow).toBe('drafting');
    expect(parsed?.verificationStatus).toBe('LAWYER_REVIEW_REQUIRED');
    expect(parsed?.requiresLawyerReview).toBe(true);
  });
});

describe('AdminAiObservabilityService.getRunQualityByCountry', () => {
  it('keeps each jurisdiction in its own bucket instead of averaging them together', async () => {
    const svc = service([
      researchRun(),
      researchRun({ countryCode: 'KE', authoritiesRetrieved: 0, authoritiesAfterPack: 0 }),
      researchRun({ countryCode: 'KE', authoritiesRetrieved: 2, authoritiesAfterPack: 1 }),
    ]);

    const { items: rows } = await svc.getRunQualityByCountry();

    expect(rows.map((r) => r.countryCode)).toEqual(['KE', 'IN']);
    const kenya = rows.find((r) => r.countryCode === 'KE')!;
    expect(kenya.runs).toBe(2);
    expect(kenya.avgAuthoritiesRetrieved).toBe(1);
    expect(kenya.zeroAuthorityRate).toBe(0.5);
  });

  it('counts a run as connector-degraded when any connector reports non-ok', async () => {
    const svc = service([
      researchRun({ connectorHealth: [{ source: 'ekshr', status: 'error' }] }),
      researchRun(),
    ]);

    const { items: [india] } = await svc.getRunQualityByCountry();

    expect(india.deadConnectorRuns).toBe(1);
    expect(india.runs).toBe(2);
  });

  it('surfaces silent model downgrades as a fallback rate', async () => {
    const svc = service([
      researchRun({ routedModel: 'gpt-5.6-terra', actualModel: 'gpt-5.6-luna', modelFellBack: true }),
      researchRun(),
      researchRun(),
      researchRun(),
    ]);

    const { items: [india] } = await svc.getRunQualityByCountry();

    expect(india.modelFallbacks).toBe(1);
    expect(india.modelFallbackRate).toBe(0.25);
  });

  it('separates a scope-clarification abort from a real research run', async () => {
    const svc = service([
      researchRun({ clarificationReason: 'Ambiguous forum', authoritiesRetrieved: 0 }),
      researchRun(),
    ]);

    const { items: [india] } = await svc.getRunQualityByCountry();

    expect(india.clarificationAborts).toBe(1);
    expect(india.verificationStatuses).toEqual({ verified: 2 });
  });

  it('filters to one flow when asked, so drafting does not skew research numbers', async () => {
    const svc = service([
      researchRun(),
      { telemetry: { flow: 'drafting', countryCode: 'IN', citationsStripped: 3 }, latencyMs: 5 },
    ]);

    const research = (await svc.getRunQualityByCountry({ flow: 'research' })).items;
    const drafting = (await svc.getRunQualityByCountry({ flow: 'drafting' })).items;

    expect(research[0].runs).toBe(1);
    expect(research[0].citationsStripped).toBe(0);
    expect(drafting[0].runs).toBe(1);
    expect(drafting[0].citationsStripped).toBe(3);
  });

  it('tells the admin when the window was cut off instead of quietly showing part of it', async () => {
    const capped = await service(Array.from({ length: 5000 }, () => researchRun()))
      .getRunQualityByCountry();
    const complete = await service([researchRun()]).getRunQualityByCountry();

    expect(capped.truncated).toBe(true);
    expect(capped.rowsScanned).toBe(5000);
    expect(complete.truncated).toBe(false);
  });

  it('ignores a flow value it does not recognise rather than returning nothing', async () => {
    const svc = service([researchRun()]);

    const result = await svc.getRunQualityByCountry({ flow: 'drafting; DROP TABLE' as never });

    expect(result.flow).toBe('all');
    expect(result.items[0].runs).toBe(1);
  });

  it('buckets runs with no country under unknown rather than dropping them', async () => {
    const svc = service([{ telemetry: { flow: 'research' }, latencyMs: null }]);

    const { items: [row] } = await svc.getRunQualityByCountry();

    expect(row.countryCode).toBe('unknown');
    expect(row.runs).toBe(1);
  });
});
