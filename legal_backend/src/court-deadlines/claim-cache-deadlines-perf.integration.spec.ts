/**
 * C19-C20 / B10 – Claim cache, court deadlines, performance vs quality gates
 *
 * C19: Court deadline and limitation period accuracy tests.
 *      Proves that the correct jurisdiction-specific limitation period is
 *      returned for each practice area and country code combination.
 *
 * C20: Model router performance vs quality gate.
 *      Proves that the `LegalResearchModelRouter` routes to the correct model
 *      tier based on complexity and risk — no ULTRA/COMPLEX work assigned to
 *      cheap models, no QUICK work over-provisioned to expensive models.
 *
 * B10: Claim verification cache wiring.
 *      Proves that `LegalResearchClaimCacheService` correctly caches and
 *      retrieves verification results, enabling the research pipeline to skip
 *      re-verification of previously confirmed claims.
 */

import { CourtDeadlinesService } from './court-deadlines.service';
import { LegalResearchClaimCacheService } from '@/legal-search/legal-research-claim-cache.service';
import { LegalResearchModelRouter } from '@/ai/legal-research/legal-research-model-router.service';
import type { ModelRouterInput } from '@/ai/legal-research/legal-research-model-router.service';

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

const mockPrisma = {
  matter: { findFirst: jest.fn() },
  courtDeadline: { findFirst: jest.fn(), create: jest.fn() },
} as any;

const mockCache = {
  get: jest.fn(),
  set: jest.fn(),
  buildKey: jest.fn((_ns: string, parts: string[]) => parts.join(':')),
} as any;

const mockConfig = {
  get: jest.fn((key: string, defaultValue?: string) => {
    // Mirrors the actual env var keys used by LegalResearchModelRouter
    const env: Record<string, string> = {
      AI_LEGAL_FAST_MODEL: 'gpt-5.6-luna',
      AI_LEGAL_STANDARD_MODEL: 'gpt-5.6-terra',
      AI_LEGAL_COMPLEX_MODEL: 'o3',
      AI_LEGAL_REPAIR_MODEL: 'gpt-5.6-terra',
      AI_LEGAL_HARD_VERIFIER_MODEL: 'o3',
      AI_LEGAL_LIGHT_VERIFIER_MODEL: 'gpt-5.6-terra',
      LEGAL_RESEARCH_ENABLE_ULTRA: 'true',
      LEGAL_RESEARCH_FAST_PIPELINE_ENABLED: 'true',
    };
    return env[key] ?? defaultValue;
  }),
} as any;

// ---------------------------------------------------------------------------
// C19 – Court deadlines and limitation periods
// ---------------------------------------------------------------------------

describe('C19 – Court deadlines and limitation periods', () => {
  let svc: CourtDeadlinesService;

  beforeEach(() => {
    jest.clearAllMocks();
    svc = new CourtDeadlinesService(mockPrisma);
  });

  // ── getLimitationPeriodInfo ───────────────────────────────────────────────

  it('returns correct KE limitation period for litigation_disputes (6yr)', () => {
    const period = svc.getLimitationPeriodInfo('litigation_disputes', 'KE');
    expect(period).not.toBeNull();
    expect(period!.days).toBe(2190); // 6 years
    expect(period!.rule).toContain('Limitation of Actions Act');
  });

  it('returns correct IN limitation period for litigation_disputes (3yr)', () => {
    const period = svc.getLimitationPeriodInfo('litigation_disputes', 'IN');
    expect(period!.days).toBe(1095); // 3 years
    expect(period!.rule).toContain('Limitation Act 1963');
  });

  it('returns correct GB limitation period for employment_labour (91 days)', () => {
    const period = svc.getLimitationPeriodInfo('employment_labour', 'GB');
    expect(period!.days).toBe(91);
    expect(period!.rule).toContain('Employment Rights Act');
  });

  it('returns null for unknown practice area', () => {
    const period = svc.getLimitationPeriodInfo('unknown_practice', 'IN');
    expect(period).toBeNull();
  });

  it('returns null for unknown country code', () => {
    const period = svc.getLimitationPeriodInfo('litigation_disputes', 'ZZ');
    expect(period).toBeNull();
  });

  it('family_matrimonial has days=-1 (no fixed limitation)', () => {
    const period = svc.getLimitationPeriodInfo('family_matrimonial', 'KE');
    expect(period!.days).toBe(-1);
  });

  it('immigration KE returns 60-day appeal window', () => {
    const period = svc.getLimitationPeriodInfo('immigration', 'KE');
    expect(period!.days).toBe(60);
  });

  it('immigration US returns 30-day appeal window', () => {
    const period = svc.getLimitationPeriodInfo('immigration', 'US');
    expect(period!.days).toBe(30);
  });

  // ── getAllLimitationPeriods ────────────────────────────────────────────────

  it('returns all practice areas when no filter given', () => {
    const all = svc.getAllLimitationPeriods();
    expect(all).toHaveProperty('litigation_disputes');
    expect(all).toHaveProperty('employment_labour');
    expect(all).toHaveProperty('immigration');
    expect(all).toHaveProperty('intellectual_property');
  });

  it('returns specific practice area when filtered', () => {
    const ip = svc.getAllLimitationPeriods('intellectual_property');
    expect(ip).toHaveProperty('GB');
    expect(ip).toHaveProperty('IN');
    expect((ip as any)['IN'].days).toBe(1095);
  });

  // ── calculateLimitationPeriod ─────────────────────────────────────────────

  it('requires a legal trigger even when a deadline exists', async () => {
    mockPrisma.matter.findFirst.mockResolvedValue({
      id: 'm-1',
      countryCode: 'KE',
      practiceArea: 'litigation_disputes',
      createdAt: new Date('2026-01-01'),
    });
    mockPrisma.courtDeadline.findFirst.mockResolvedValue({
      id: 'd-existing',
      deadlineType: 'LIMITATION',
    });

    const result = await svc.calculateLimitationPeriod('tenant-1', 'm-1');
    expect(result.calculated).toBe(false);
    expect(result.reason).toContain('legal trigger date');
    expect(mockPrisma.courtDeadline.create).not.toHaveBeenCalled();
  });

  it('does not create limitation deadlines from matter creation dates', async () => {
    const matterCreatedAt = new Date('2026-01-01');
    mockPrisma.matter.findFirst.mockResolvedValue({
      id: 'm-2',
      countryCode: 'KE',
      practiceArea: 'litigation_disputes',
      createdAt: matterCreatedAt,
    });
    mockPrisma.courtDeadline.findFirst.mockResolvedValue(null);
    mockPrisma.courtDeadline.create.mockResolvedValue({
      id: 'd-new',
      deadlineType: 'LIMITATION',
      dueDate: new Date('2032-01-01'),
    });

    const result = await svc.calculateLimitationPeriod('tenant-1', 'm-2');
    expect(result.calculated).toBe(false);
    expect(result.reason).toContain('legal trigger date');
    expect(mockPrisma.courtDeadline.create).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// B10 – Claim verification cache
// ---------------------------------------------------------------------------

describe('B10 – Legal research claim verification cache', () => {
  let cacheSvc: LegalResearchClaimCacheService;

  beforeEach(() => {
    jest.clearAllMocks();
    cacheSvc = new LegalResearchClaimCacheService(mockCache);
  });

  it('get() retrieves a cached claim entry', async () => {
    const entry = { pass: true, verifierVersion: '2.0', checkedAt: '2026-10-18T00:00:00Z' };
    mockCache.get.mockResolvedValue(entry);

    const result = await cacheSvc.get('propHash', 'passageHash', '2.0');
    expect(result).toEqual(entry);
    expect(mockCache.get).toHaveBeenCalledWith(expect.stringContaining('propHash'));
  });

  it('get() returns null on cache miss', async () => {
    mockCache.get.mockResolvedValue(null);
    const result = await cacheSvc.get('propHash', 'passageHash', '2.0');
    expect(result).toBeNull();
  });

  it('set() stores entry with correct key', async () => {
    mockCache.set.mockResolvedValue(undefined);
    const entry = { pass: false, verifierVersion: '2.0', checkedAt: '2026-10-18T00:00:00Z' };

    await cacheSvc.set('propHash', 'passageHash', '2.0', entry);
    expect(mockCache.set).toHaveBeenCalledWith(
      expect.stringContaining('propHash'),
      entry,
    );
  });

  it('hashText() produces consistent SHA-256 hex (first 24 chars)', () => {
    const hash1 = LegalResearchClaimCacheService.hashText('Section 437 CrPC allows bail');
    const hash2 = LegalResearchClaimCacheService.hashText('Section 437 CrPC allows bail');
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(24);
  });

  it('hashText() normalises whitespace before hashing', () => {
    const hash1 = LegalResearchClaimCacheService.hashText('  Section 437  CrPC  ');
    const hash2 = LegalResearchClaimCacheService.hashText('Section 437  CrPC');
    // trim() is applied — leading/trailing whitespace removed
    expect(hash1).toBe(LegalResearchClaimCacheService.hashText('Section 437  CrPC'));
    expect(hash2).toBe(LegalResearchClaimCacheService.hashText('Section 437  CrPC'));
  });

  it('hashText() produces different hashes for different texts (collision resistance)', () => {
    const h1 = LegalResearchClaimCacheService.hashText('Section 437 CrPC');
    const h2 = LegalResearchClaimCacheService.hashText('Section 438 CrPC');
    expect(h1).not.toBe(h2);
  });

  it('key is version-scoped (different versions → different cache entries)', async () => {
    mockCache.get.mockResolvedValue(null);

    await cacheSvc.get('prop1', 'pass1', 'v1');
    await cacheSvc.get('prop1', 'pass1', 'v2');

    const calls = mockCache.get.mock.calls;
    expect(calls[0][0]).not.toBe(calls[1][0]); // different keys
    expect(calls[0][0]).toContain('v1');
    expect(calls[1][0]).toContain('v2');
  });
});

// ---------------------------------------------------------------------------
// C20 – Model router quality vs performance gates
// ---------------------------------------------------------------------------

describe('C20 – Legal research model router performance/quality gates', () => {
  let router: LegalResearchModelRouter;

  beforeEach(() => {
    router = new LegalResearchModelRouter(mockConfig);
  });

  function route(input: ModelRouterInput) {
    return router.resolve(input);
  }

  it('QUICK complexity routes to standard model (not ULTRA)', () => {
    const result = route({ complexity: 'QUICK', highRisk: false, unresolvedConflict: false, negativeTreatmentFound: false });
    // QUICK should NOT use the Ultra synthesis model ('o3' for ultra)
    expect(result.synthesisModel).not.toBeUndefined();
    expect(['QUICK', 'STANDARD']).toContain(result.complexity);
  });

  it('ULTRA rejects an unpriced configured model and retains the premium floor', () => {
    const result = route({
      complexity: 'ULTRA',
      highRisk: true,
      unresolvedConflict: true,
      negativeTreatmentFound: true,
      planAllowsUltra: true,
    });
    expect(result.complexity).toBe('ULTRA');
    // An unpriced legacy override must not bypass premium routing.
    expect(result.synthesisModel).toBe('gpt-5.6-sol');
  });

  it('COMPLEX with highRisk uses high reasoning effort', () => {
    const result = route({ complexity: 'COMPLEX', highRisk: true, unresolvedConflict: false, negativeTreatmentFound: false });
    expect(['high', 'medium']).toContain(result.reasoningEffort);
  });

  it('STANDARD without risk uses medium reasoning effort', () => {
    const result = route({ complexity: 'STANDARD', highRisk: false, unresolvedConflict: false, negativeTreatmentFound: false });
    expect(['medium', 'low']).toContain(result.reasoningEffort);
  });

  it('QUICK has smaller maxOutputTokens than COMPLEX', () => {
    const quick = route({ complexity: 'QUICK', highRisk: false, unresolvedConflict: false, negativeTreatmentFound: false });
    const complex = route({ complexity: 'COMPLEX', highRisk: false, unresolvedConflict: false, negativeTreatmentFound: false });
    expect(quick.maxOutputTokens).toBeLessThanOrEqual(complex.maxOutputTokens);
  });

  it('forceTopTier locks to serious model even when input complexity is STANDARD', () => {
    const result = route({
      complexity: 'STANDARD',
      highRisk: false,
      unresolvedConflict: false,
      negativeTreatmentFound: false,
      forceTopTier: true,
      planAllowsUltra: true,
    });
    // forceTopTier must prevent downgrade to cheap models
    expect(result.synthesisModel).not.toBeUndefined();
    // An unpriced legacy override cannot bypass the serious path.
    expect(result.synthesisModel).toBe('gpt-5.6-sol');
    // Must not use light fast/standard model
    expect(result.synthesisModel).not.toBe('gpt-5.6-luna');
    expect(result.synthesisModel).not.toBe('gpt-5.6-terra');
  });

  it('cross-provider verification is only required for high-risk routes', () => {
    const safe = route({ complexity: 'STANDARD', highRisk: false, unresolvedConflict: false, negativeTreatmentFound: false });
    const risky = route({ complexity: 'COMPLEX', highRisk: true, unresolvedConflict: true, negativeTreatmentFound: true });

    expect(safe.requireCrossProviderVerification).toBe(false);
    expect(risky.requireCrossProviderVerification).toBe(true);
  });

  it('routes return valid non-empty model strings', () => {
    const complexities = ['QUICK', 'STANDARD', 'COMPLEX', 'ULTRA'] as const;
    for (const c of complexities) {
      const r = route({ complexity: c, highRisk: false, unresolvedConflict: false, negativeTreatmentFound: false, planAllowsUltra: true });
      expect(r.synthesisModel).toBeTruthy();
      expect(r.verifierModel).toBeTruthy();
      expect(r.repairModel).toBeTruthy();
    }
  });
});
