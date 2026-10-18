import { CitationFirstLookupService } from './citation-first-lookup.service';

describe('CitationFirstLookupService Kenya', () => {
  const prisma = {
    legalAuthority: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'case-ke-judgment-1',
          title: 'Giella v Cassman Brown',
          citation: '[1973] EA 358',
          sourceName: 'Kenya Law',
          summary: 'Injunction principles',
          fullText: 'Full judgment text',
          sourceUrl: 'https://new.kenyalaw.org/akn/ke/judgment/kehc/1973/1',
          holding: null,
          countryCode: 'KE',
          jurisdiction: 'High Court',
          authorityType: 'CASE_LAW',
        },
      ]),
    },
  };
  const kenyaLawJudgments = {
    searchJudgments: jest.fn().mockResolvedValue([]),
  };

  const service = new CitationFirstLookupService(
    prisma as never,
    kenyaLawJudgments as never,
  );

  it('detects Kenya citations', () => {
    expect(service.isCitationQuery('[2024] KESC 12 (KLR)', 'KE')).toBe(true);
    expect(service.isCitationQuery('[2019] eKLR', 'KE')).toBe(true);
    expect(service.isCitationQuery('(2024) 2 SCC 1', 'KE')).toBe(false);
  });

  it('looks up local KE authorities before live search', async () => {
    const hits = await service.lookup('Giella v Cassman Brown', 'KE');
    expect(hits).toHaveLength(1);
    expect(hits[0].id).toBe('case-ke-judgment-1');
    expect(kenyaLawJudgments.searchJudgments).not.toHaveBeenCalled();
  });
});
