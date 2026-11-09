import { DraftResearchGroundingService } from '@/ai/drafting/draft-research-grounding.service';
import type { RetrievedAuthority } from '@/legal-search/legal-retrieval.types';

describe('DraftResearchGroundingService', () => {
  const mockAuthority: RetrievedAuthority = {
    id: 'case-1',
    title: 'Rajnesh v. Neha',
    citation: '(2021) 2 SCC 324',
    sourceName: 'Indian Kanoon',
    summary: 'Maintenance quantum and financial disclosure.',
    sourceTier: 'case_law',
    authorityType: 'CASE',
  };

  let service: DraftResearchGroundingService;
  let retrieval: { retrieve: jest.Mock };
  let deepResearch: { runDeepResearch: jest.Mock };
  let config: { get: jest.Mock };
  let registry: { findForDraftKind: jest.Mock; upsertFromRetrieval: jest.Mock };
  let prisma: { aIOutput: { findMany: jest.Mock }; savedResearch: { findMany: jest.Mock }; jurisdictionForm: { findFirst: jest.Mock } };

  let access: { assertMatterReadable: jest.Mock };
  beforeEach(() => {
    retrieval = {
      retrieve: jest.fn().mockResolvedValue({
        authorities: [mockAuthority, { ...mockAuthority, id: 'case-2', title: 'Bhuwan Mohan Singh v. Meena' }],
        confidence: 'high',
        queryHash: 'abc',
        isBareActQuery: false,
        primaryTierCount: 0,
      }),
    };
    deepResearch = { runDeepResearch: jest.fn() };
    config = { get: jest.fn().mockReturnValue('gpt-4o-mini') };
    registry = {
      findForDraftKind: jest.fn().mockResolvedValue([]),
      upsertFromRetrieval: jest.fn().mockResolvedValue(undefined),
    };
    prisma = {
      aIOutput: { findMany: jest.fn().mockResolvedValue([]) },      savedResearch: { findMany: jest.fn().mockResolvedValue([]) },
      jurisdictionForm: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    access = { assertMatterReadable: jest.fn().mockResolvedValue(undefined) };
    service = new DraftResearchGroundingService(
      retrieval as never,
      deepResearch as never,
      config as never,
      registry as never,
      prisma as never,
      access as never,    );
  });

  it('builds VERIFIED AUTHORITIES block from retrieved case law', async () => {
    const result = await service.buildGrounding({
      kind: 'india_maintenance_order_revision',
      caseDetails: 'Ram vs Ria interim maintenance Gujarat HC',
      countryCode: 'IN',
      tenantId: 't1',
      userId: 'u1',
    });

    expect(result.authorities.length).toBeGreaterThanOrEqual(1);
    expect(result.verifiedAuthoritiesBlock).toContain('VERIFIED AUTHORITIES');
    expect(result.verifiedAuthoritiesBlock).toContain('Rajnesh v. Neha');
    expect(result.verifiedAuthoritiesBlock).toContain('(2021) 2 SCC 324');
  });

  it('searches independent issue queries concurrently with at most three active connector requests', async () => {
    let active = 0;
    let maximum = 0;
    retrieval.retrieve.mockImplementation(async () => {
      active++;
      maximum = Math.max(maximum, active);
      await new Promise<void>((resolve) => setImmediate(resolve));
      active--;
      return { authorities: [mockAuthority], confidence: 'high' };
    });
    const result = await service.buildGrounding({
      kind: 'india_maintenance_order_revision', countryCode: 'IN', tenantId: 't1', userId: 'u1',
      caseDetails: 'Maintenance quantum dispute and financial disclosure',
      extraRetrievalQueries: Array.from({ length: 8 }, (_, i) => `Independent issue ${i} maintenance authority`),
    });
    expect(retrieval.retrieve.mock.calls.length).toBeGreaterThan(3);
    expect(maximum).toBe(3);
    expect(active).toBe(0);
    expect(result.authorities.some((a) => a.id === mockAuthority.id)).toBe(true);
  });

  it('returns placeholder instruction when no authorities retrieved', () => {
    const block = service.buildVerifiedAuthoritiesBlock([]);
    expect(block).toContain('[AUTHORITY TO BE ADDED]');
    expect(block).toContain('No verified case law retrieved');
  });

  it('uses matter saved research as VERIFIED AUTHORITIES and skips curated substitutes', async () => {
    const canonicalResearch = {
          citations: [
            {
              id: 'stat-1',
              title: 'BNSS §480',
              citation: 'BNSS 480',
              authorityType: 'STATUTE',
              sourceTier: 'primary',
              sourceName: 'India Code',
            },
          ],
          similarCases: [
            {
              authorityId: 'saved-case-1',
              title: 'Satender Kumar Antil v. CBI',
              citation: '(2022) 10 SCC 51',
              verificationStatus: 'verified',
              sourceName: 'Saved research',
            },
          ],
        };
    prisma.savedResearch.findMany.mockResolvedValue([{ aiOutputId: 'verified-server-output', researchJson: { similarCases: [{ title: 'Forged client authority', verificationStatus: 'verified' }] } }]);
    prisma.aIOutput.findMany.mockResolvedValue([{ verified: true, requiresLawyerReview: false, citations: { cachePayload: canonicalResearch } }]);

    const result = await service.buildGrounding({
      kind: 'india_regular_bail',
      caseDetails: 'Regular bail under BNSS 480',
      countryCode: 'IN',
      tenantId: 't1',
      userId: 'u1',
      matterId: 'm1',
      hybridExpressNotice: true,
    });

    expect(result.verifiedAuthoritiesBlock).toContain('Satender Kumar Antil v. CBI');
    expect(result.verifiedAuthoritiesBlock).not.toContain('Forged client authority');
    expect(result.verifiedAuthoritiesBlock).toContain('BNSS §480');
    expect(result.authorities.some((item) => item.id.startsWith('curated__'))).toBe(false);
    expect(retrieval.retrieve).not.toHaveBeenCalled();
  });
  it('does not read saved research across a denied matter boundary', async () => {
    const denied = new Error('Matter access denied');
    access.assertMatterReadable.mockRejectedValue(denied);
    await expect(service.buildGrounding({ kind: 'india_regular_bail_bnss_480', caseDetails: 'QA', countryCode: 'IN',
      tenantId: 't1', userId: 'u1', matterId: 'restricted' })).rejects.toBe(denied);
    expect(prisma.savedResearch.findMany).not.toHaveBeenCalled();
  });

});
