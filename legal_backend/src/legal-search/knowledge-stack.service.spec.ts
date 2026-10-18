import { KnowledgeStackService } from './knowledge-stack.service';

describe('KnowledgeStackService source filtering', () => {
  it('selects only REGULATION authorities for regulations-only retrieval', async () => {
    const hybridSearch = {
      search: jest.fn().mockResolvedValue([
        {
          id: 'rbi-regulation',
          title: 'RBI Direction',
          citation: 'RBI/1',
          sourceName: 'Reserve Bank of India',
          summary: 'Digital lending customer protection requirements.',
          sourceUrl: 'https://www.rbi.org.in/example',
          holding: null,
          countryCode: 'IN',
          jurisdiction: 'IN',
          authorityType: 'REGULATION',
          score: 1,
        },
      ]),
    };
    const service = new KnowledgeStackService(
      hybridSearch as never,
      { lookupSection: jest.fn(), lookupExactSection: jest.fn() } as never,
      { search: jest.fn() } as never,
      { matter: { findFirst: jest.fn().mockResolvedValue(null) } } as never,
      { isCitationOrTitleQuery: jest.fn().mockReturnValue(false), lookup: jest.fn() } as never,
    );

    const result = await service.search({
      query: 'digital lending directions',
      countryCode: 'IN',
      knowledgeSources: ['regulations'],
    });

    expect(hybridSearch.search).toHaveBeenCalledWith(
      'digital lending directions',
      expect.objectContaining({ authorityTypes: ['REGULATION'] }),
    );
    expect(result.authorities).toEqual([
      expect.objectContaining({ id: 'rbi-regulation', authorityType: 'REGULATION' }),
    ]);
  });

  it('does not run generic local authority search for web-only retrieval', async () => {
    const hybridSearch = { search: jest.fn() };
    const service = new KnowledgeStackService(
      hybridSearch as never,
      { lookupSection: jest.fn(), lookupExactSection: jest.fn() } as never,
      { search: jest.fn() } as never,
      { matter: { findFirst: jest.fn().mockResolvedValue(null) } } as never,
      { isCitationOrTitleQuery: jest.fn().mockReturnValue(false), lookup: jest.fn() } as never,
    );
    const result = await service.search({
      query: 'official source',
      countryCode: 'IN',
      knowledgeSources: ['web'],
    });
    expect(hybridSearch.search).not.toHaveBeenCalled();
    expect(result.authorities).toEqual([]);
  });
});
