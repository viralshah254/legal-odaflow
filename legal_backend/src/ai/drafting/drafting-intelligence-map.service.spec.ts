import { DraftingIntelligenceMapService } from './drafting-intelligence-map.service';
import type { ResearchIntelligenceMap } from '@/ai/legal-research/research-intelligence-map.types';

function stubMap(overrides: Partial<ResearchIntelligenceMap> = {}): ResearchIntelligenceMap {
  return {
    version: 1,
    modelName: 'mock',
    degraded: false,
    jurisdiction: ['IN'],
    jurisdictionConfidence: 0.8,
    issues: [
      { id: 'issue-1', label: 'Interim maintenance quantum under BNSS §144', kind: 'remedy', priority: 1 },
    ],
    likelyDoctrines: [],
    likelyStatutes: [
      {
        id: 'statute-1',
        kind: 'statute',
        title: 'BNSS 2023 §144',
        citation: null,
        court: null,
        proposition: 'Maintenance of wives, children and parents',
        searchHints: ['BNSS 144 maintenance Supreme Court'],
        origin: 'MODEL_KNOWLEDGE',
        verificationStatus: 'CANDIDATE',
        confidence: 'high',
        note: null,
      },
    ],
    likelyRegulations: [],
    likelyCases: [],
    likelyProceduralRoutes: [],
    likelyRegulators: [],
    terminology: [],
    alternateTerminology: [],
    unresolvedQuestions: [],
    researchQueries: [
      {
        id: 'q-1',
        query: 'BNSS 144 interim maintenance quantum case law',
        purpose: 'case',
        issueIds: ['issue-1'],
        priority: 1,
      },
    ],
    contraryAuthorityQueries: [],
    generatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('DraftingIntelligenceMapService', () => {
  it('wraps ResearchIntelligenceMapService.buildMap into drafting queries/hints', async () => {
    const map = stubMap();
    const researchMap = {
      buildMap: jest.fn().mockResolvedValue(map),
      expandRetrievalQueries: jest.fn().mockReturnValue([
        'BNSS 144 interim maintenance quantum case law',
        'BNSS 144 maintenance Supreme Court',
      ]),
      fallbackMap: jest.fn(),
    };

    const service = new DraftingIntelligenceMapService(researchMap as never);
    const result = await service.buildMap({
      caseDetails: 'Wife seeks interim maintenance revision in Gujarat HC',
      countryCode: 'IN',
      kind: 'india_maintenance_order_revision',
    });

    expect(researchMap.buildMap).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'Wife seeks interim maintenance revision in Gujarat HC',
        countryCode: 'IN',
        legalDomain: 'india_maintenance_order_revision',
      }),
    );
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].label).toMatch(/maintenance/i);
    expect(result.likelyStatutes[0].title).toMatch(/BNSS/);
    expect(result.researchQueries).toEqual(
      expect.arrayContaining(['BNSS 144 interim maintenance quantum case law']),
    );
    expect(result.searchHints).toContain('BNSS 144 maintenance Supreme Court');
    expect(result.raw).toBe(map);
  });

  it('uses fallback map when caseDetails is empty', async () => {
    const fallback = stubMap({ degraded: true, degradationReason: 'empty caseDetails' });
    const researchMap = {
      buildMap: jest.fn(),
      expandRetrievalQueries: jest.fn().mockReturnValue(['fallback query']),
      fallbackMap: jest.fn().mockReturnValue(fallback),
    };

    const service = new DraftingIntelligenceMapService(researchMap as never);
    const result = await service.buildMap({ caseDetails: '   ' });

    expect(researchMap.buildMap).not.toHaveBeenCalled();
    expect(researchMap.fallbackMap).toHaveBeenCalled();
    expect(result.researchQueries).toEqual(['fallback query']);
  });
});
