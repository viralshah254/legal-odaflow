import { CaseLawRecoveryService } from './case-law-recovery.service';
import { KenyaLawQueryBuilderService } from './kenya-law-query-builder.service';
import { IndiaKanoonQueryBuilderService } from './india-kanoon-query-builder.service';

describe('CaseLawRecoveryService Kenya branch', () => {
  it('uses KeEvidenceIngest and never calls India Kanoon for KE', async () => {
    const searchWithOutcome = jest.fn();
    const retrieveAndIngest = jest.fn().mockResolvedValue({
      authorities: [
        {
          id: 'ke-case-1',
          title: 'Borrower v Digital Lender',
          citation: '[2023] KEHC 100 (KLR)',
          sourceName: 'Kenya Law',
          sourceTier: 'case_law',
          authorityType: 'CASE',
          relevanceGate: 'admitted',
          summary: 'CRB listing disputed after alleged identity theft.',
          fullText: 'The court considered CRB listing and identity theft. '.repeat(5),
        },
      ],
      packDelta: [],
      queries: ['CRB listing identity theft'],
      searchStatus: 'searched',
      diagnostics: [
        {
          query: 'CRB listing identity theft',
          status: 'searched',
          hitCount: 1,
          admittedCount: 1,
          rejectedCount: 0,
          rejectionReasons: {},
        },
      ],
    });
    const discovery = {
      planCandidates: jest.fn().mockResolvedValue({
        candidates: [],
        alternateSearchPhrases: [],
        degraded: false,
      }),
    };

    const service = new CaseLawRecoveryService(
      new IndiaKanoonQueryBuilderService(),
      discovery as never,
      new KenyaLawQueryBuilderService(),
      { retrieveAndIngest } as never,
      { isConfigured: () => true, searchWithOutcome } as never,
      undefined,
    );

    const result = await service.recover({
      query: 'fraudulent digital loan identity theft CRB listing Kenya',
      countryCode: 'KE',
      legalIssues: ['CRB listing after identity theft'],
      maxQueries: 4,
    });

    expect(searchWithOutcome).not.toHaveBeenCalled();
    expect(retrieveAndIngest).toHaveBeenCalled();
    expect(result.authorities.some((a) => a.id === 'ke-case-1')).toBe(true);
    expect(result.diagnostics.some((d) => d.provider === 'kenya-law-relaxation')).toBe(true);
  });
});
