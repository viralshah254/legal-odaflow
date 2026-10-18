import { SimilarCasesService } from './similar-cases.service';

describe('SimilarCasesService.classifySearchOutcome', () => {
  const service = new SimilarCasesService();

  it('distinguishes provider failure from no results', () => {
    expect(
      service.classifySearchOutcome({
        attempted: true,
        similarCases: [],
        caseLawSearchStatus: 'circuit_open',
        rawCaseLawAuthorityCount: 0,
      }),
    ).toBe('PROVIDER_FAILURE');

    expect(
      service.classifySearchOutcome({
        attempted: true,
        similarCases: [],
        caseLawSearchStatus: 'no_hits',
        rawCaseLawAuthorityCount: 0,
      }),
    ).toBe('NO_RESULTS_AFTER_SUCCESSFUL_SEARCH');
  });

  it('reports unverified when raw case authorities exist but none admitted', () => {
    expect(
      service.classifySearchOutcome({
        attempted: true,
        similarCases: [],
        caseLawSearchStatus: 'searched',
        rawCaseLawAuthorityCount: 3,
      }),
    ).toBe('AUTHORITIES_FOUND_BUT_UNVERIFIED');
  });

  it('reports CASES_FOUND when verified similar cases exist', () => {
    expect(
      service.classifySearchOutcome({
        attempted: true,
        similarCases: [
          {
            authorityId: 'c1',
            title: 'A v B',
            citation: null,
            court: null,
            year: '2020',
            sourceUrl: null,
            sourceName: 'Indian Kanoon',
            summary: null,
            relevantSections: [],
            relevance: null,
            bindingWeight: 'binding',
            confidence: 0.8,
            verificationStatus: 'verified',
          },
        ],
        caseLawSearchStatus: 'searched',
        rawCaseLawAuthorityCount: 1,
      }),
    ).toBe('CASES_FOUND');
  });
});
