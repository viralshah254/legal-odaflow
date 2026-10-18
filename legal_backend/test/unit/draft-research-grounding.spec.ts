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
  let prisma: { savedResearch: { findMany: jest.Mock }; jurisdictionForm: { findFirst: jest.Mock } };

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
      savedResearch: { findMany: jest.fn().mockResolvedValue([]) },
      jurisdictionForm: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    service = new DraftResearchGroundingService(
      retrieval as never,
      deepResearch as never,
      config as never,
      registry as never,
      prisma as never,
    );
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

  it('returns placeholder instruction when no authorities retrieved', () => {
    const block = service.buildVerifiedAuthoritiesBlock([]);
    expect(block).toContain('[AUTHORITY TO BE ADDED]');
    expect(block).toContain('No verified case law retrieved');
  });

  it('uses matter saved research as VERIFIED AUTHORITIES and skips curated substitutes', async () => {
    prisma.savedResearch.findMany.mockResolvedValue([
      {
        researchJson: {
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
        },
      },
    ]);

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
    expect(result.verifiedAuthoritiesBlock).toContain('BNSS §480');
    expect(result.authorities.some((item) => item.id.startsWith('curated__'))).toBe(false);
    expect(retrieval.retrieve).not.toHaveBeenCalled();
  });
});
