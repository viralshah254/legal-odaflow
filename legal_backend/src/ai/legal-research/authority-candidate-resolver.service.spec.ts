jest.mock('@/legal-search/legal-retrieval-orchestrator.service', () => ({
  LegalRetrievalOrchestrator: class LegalRetrievalOrchestrator {},
}));

import {
  AuthorityCandidateResolverService,
  titleOverlap,
} from './authority-candidate-resolver.service';
import type { ResearchIntelligenceMap } from './research-intelligence-map.types';

function baseMap(overrides: Partial<ResearchIntelligenceMap> = {}): ResearchIntelligenceMap {
  return {
    version: 1,
    modelName: 'test',
    degraded: false,
    jurisdiction: ['KE'],
    jurisdictionConfidence: 0.8,
    issues: [{ id: 'i1', label: 'Digital loan fraud', kind: 'substantive', priority: 1 }],
    likelyDoctrines: [],
    likelyStatutes: [],
    likelyRegulations: [],
    likelyCases: [
      {
        id: 'c1',
        kind: 'case',
        title: 'Ouma v Safaricom',
        citation: '[2020] eKLR',
        searchHints: ['Ouma Safaricom CRB'],
        origin: 'MODEL_KNOWLEDGE',
        verificationStatus: 'CANDIDATE',
      },
      {
        id: 'c2',
        kind: 'case',
        title: 'Invented Fake Case Ltd v Nobody',
        citation: null,
        searchHints: ['invented fake'],
        origin: 'MODEL_KNOWLEDGE',
        verificationStatus: 'CANDIDATE',
      },
    ],
    likelyProceduralRoutes: [],
    likelyRegulators: [],
    terminology: [],
    alternateTerminology: [],
    unresolvedQuestions: [],
    researchQueries: [],
    contraryAuthorityQueries: [],
    generatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('AuthorityCandidateResolverService', () => {
  it('titleOverlap matches party-style titles', () => {
    expect(titleOverlap('Ouma v Safaricom PLC', 'Ouma v Safaricom')).toBe(true);
    expect(titleOverlap('Completely Different Matter', 'Ouma v Safaricom')).toBe(false);
  });

  it('resolves from prior authorities without calling retrieve for matches', async () => {
    const retrieve = jest.fn().mockResolvedValue({ authorities: [], connectorDiagnostics: [] });
    const service = new AuthorityCandidateResolverService({ retrieve } as never);
    const result = await service.resolve({
      map: baseMap({
        likelyCases: [
          {
            id: 'c1',
            kind: 'case',
            title: 'Ouma v Safaricom',
            citation: '[2020] eKLR',
            searchHints: [],
            origin: 'MODEL_KNOWLEDGE',
            verificationStatus: 'CANDIDATE',
          },
        ],
      }),
      countryCode: 'KE',
      userId: 'u1',
      priorAuthorities: [
        {
          id: 'ke-1',
          title: 'Ouma v Safaricom',
          citation: '[2020] eKLR',
          sourceName: 'Kenya Law',
          summary: 'CRB listing dispute',
          sourceTier: 'case_law',
        },
      ],
      maxCandidates: 1,
      deadlineMs: 5_000,
    });

    expect(retrieve).not.toHaveBeenCalled();
    expect(result.resolved).toEqual([
      expect.objectContaining({ id: 'c1', verificationStatus: 'RETRIEVED' }),
    ]);
    expect(result.diagnostics[0]?.status).toBe('RETRIEVED_PRIOR');
  });

  it('leaves unmatched AI names UNVERIFIED — never silent-verify', async () => {
    const retrieve = jest.fn().mockResolvedValue({
      authorities: [
        {
          id: 'ke-other',
          title: 'Unrelated Bank v Customer',
          citation: '[2019] eKLR',
          sourceName: 'Kenya Law',
          summary: 'loan',
          sourceTier: 'case_law',
        },
      ],
      connectorDiagnostics: [],
    });
    const service = new AuthorityCandidateResolverService({ retrieve } as never);
    const result = await service.resolve({
      map: baseMap({
        likelyCases: [
          {
            id: 'c2',
            kind: 'case',
            title: 'Invented Fake Case Ltd v Nobody',
            searchHints: ['invented'],
            origin: 'MODEL_KNOWLEDGE',
            verificationStatus: 'CANDIDATE',
          },
        ],
      }),
      countryCode: 'KE',
      userId: 'u1',
      maxCandidates: 1,
      queriesPerCandidate: 1,
      deadlineMs: 10_000,
    });

    expect(result.resolved).toHaveLength(0);
    expect(result.unresolved[0]?.verificationStatus).toBe('UNVERIFIED');
    expect(result.unresolved[0]?.title).toContain('Invented Fake');
  });

  it('uses FAST researchMode for live candidate retrieves', async () => {
    const retrieve = jest.fn().mockResolvedValue({ authorities: [], connectorDiagnostics: [] });
    const service = new AuthorityCandidateResolverService({ retrieve } as never);
    await service.resolve({
      map: baseMap({
        likelyCases: [
          {
            id: 'c2',
            kind: 'case',
            title: 'Some Case v Another',
            searchHints: [],
            origin: 'MODEL_KNOWLEDGE',
            verificationStatus: 'CANDIDATE',
          },
        ],
      }),
      countryCode: 'KE',
      userId: 'u1',
      maxCandidates: 1,
    });

    expect(retrieve).toHaveBeenCalled();
    expect(retrieve.mock.calls[0][0].researchMode).toBe('FAST');
    expect(retrieve.mock.calls[0][0].knowledgeSources).toEqual(['case_law', 'web']);
  });
});
