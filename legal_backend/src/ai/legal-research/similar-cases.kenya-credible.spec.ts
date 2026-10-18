import { SimilarCasesService } from './similar-cases.service';

describe('SimilarCasesService Kenya credibility', () => {
  it('treats Kenya Law sourceName as verified-capable', () => {
    const service = new SimilarCasesService();
    const ranked = service.extractAndRank(
      [
        {
          id: 'ke-1',
          title: 'Kamau v Digital Credit Ltd',
          citation: '[2022] eKLR',
          sourceName: 'Kenya Law',
          sourceUrl: 'https://new.kenyalaw.org/akn/ke/judgment/kehc/2022/1/eng@2022-01-01',
          sourceTier: 'case_law',
          authorityType: 'CASE',
          summary:
            'The High Court considered whether a borrower could challenge a CRB listing arising from an allegedly fraudulent digital loan.',
          fullText:
            'Identity theft and CRB blacklisting were central. The court examined electronic KYC evidence. '.repeat(
              4,
            ),
          relevanceGate: 'admitted',
          relevanceScore: 0.8,
        },
      ],
      'fraudulent digital loan CRB listing Kenya identity theft',
      'KE',
      3,
      { legalIssues: ['CRB listing identity theft digital loan'] },
    );

    expect(ranked.length).toBeGreaterThan(0);
    expect(ranked[0]?.verificationStatus).toBe('verified');
  });
});
