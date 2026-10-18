import {
  buildIssueCoverageMatrix,
  retryableCoverageRedCells,
} from './issue-coverage-matrix';
import type { ResearchIntelligenceMap } from './research-intelligence-map.types';
import type { RetrievedAuthority } from '@/legal-search/legal-retrieval.types';

function baseMap(overrides: Partial<ResearchIntelligenceMap> = {}): ResearchIntelligenceMap {
  return {
    version: 1,
    modelName: 'test',
    degraded: false,
    jurisdiction: ['IN'],
    jurisdictionConfidence: 0.8,
    issues: [
      { id: 'i1', label: 'Credit reporting and CIBIL damage', kind: 'substantive', priority: 1 },
      { id: 'i2', label: 'Consumer remedy', kind: 'remedy', priority: 2 },
    ],
    likelyDoctrines: [],
    likelyStatutes: [],
    likelyRegulations: [],
    likelyCases: [],
    likelyProceduralRoutes: [],
    likelyRegulators: [],
    terminology: [],
    alternateTerminology: [],
    unresolvedQuestions: [],
    researchQueries: [
      {
        id: 'q1',
        query: 'CIBIL dispute RBI',
        purpose: 'regulation',
        issueIds: ['i1'],
        priority: 1,
      },
    ],
    contraryAuthorityQueries: [
      {
        id: 'cq1',
        query: 'contrary credit reporting India',
        purpose: 'contrary',
        issueIds: ['i1'],
        priority: 1,
      },
    ],
    generatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('buildIssueCoverageMatrix', () => {
  it('marks red cells when authorities are empty', () => {
    const matrix = buildIssueCoverageMatrix({
      map: baseMap(),
      authorities: [],
      contrarySearchAttempted: false,
      loopsRun: 0,
    });
    expect(matrix.complete).toBe(false);
    expect(matrix.redCells.length).toBeGreaterThan(0);
    expect(matrix.redCells.some((c) => c.dimension === 'cases')).toBe(true);
  });

  it('covers law when statute authorities match issue tokens', () => {
    const authorities: RetrievedAuthority[] = [
      {
        id: 's1',
        title: 'Consumer Protection Act, 2019',
        citation: 'CPA 2019',
        sourceName: 'India Code',
        summary: 'Consumer remedy for deficiency in service and unfair trade practice.',
        sourceTier: 'primary',
        authorityType: 'STATUTE',
      },
    ];
    const matrix = buildIssueCoverageMatrix({
      map: baseMap(),
      authorities,
      contrarySearchAttempted: true,
      loopsRun: 1,
    });
    const consumer = matrix.cells.find((c) => c.issueId === 'i2');
    expect(consumer?.law).toBe(true);
  });

  it('does not schedule case-gap retrieves under PROVIDER_FAILURE / circuit_open', () => {
    const matrix = buildIssueCoverageMatrix({
      map: baseMap(),
      authorities: [],
      contrarySearchAttempted: false,
      loopsRun: 0,
      caseLawSearchStatus: 'circuit_open',
    });
    expect(matrix.providerLimitedDimensions).toContain('cases');
    const caseReds = matrix.redCells.filter((c) => c.dimension === 'cases');
    expect(caseReds.length).toBeGreaterThan(0);
    expect(caseReds.every((c) => c.nonRetryable === true)).toBe(true);
    expect(caseReds.every((c) => c.suggestedQueries.length === 0)).toBe(true);
    const retryable = retryableCoverageRedCells(matrix);
    expect(retryable.some((c) => c.dimension === 'cases')).toBe(false);
  });
});
