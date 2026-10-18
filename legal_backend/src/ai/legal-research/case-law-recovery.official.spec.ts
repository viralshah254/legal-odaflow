import { CaseLawRecoveryService } from './case-law-recovery.service';
import { IndiaKanoonQueryBuilderService } from './india-kanoon-query-builder.service';
import { KenyaLawQueryBuilderService } from './kenya-law-query-builder.service';

describe('CaseLawRecoveryService official fallback', () => {
  it('searches e-SCR by issue when India Kanoon is down and admits only quoteable hits', async () => {
    const discovery = {
      planCandidates: jest.fn().mockResolvedValue({
        candidates: [{ title: 'Invented v Fake', citation: '(2012) 1 SCC 40', searchPhrase: 'bail' }],
        alternateSearchPhrases: [],
        degraded: false,
      }),
    };
    const escr = {
      isConfigured: () => true,
      searchJudgmentsBroad: jest.fn().mockResolvedValue([
        {
          id: '2024_1_1',
          title: 'State of NCT of Delhi v Accused',
          citation: '(2024) 1 SCR 1',
          neutralCitation: '2024 INSC 1',
          court: 'Supreme Court of India',
          sourceUrl: 'https://scr.sci.gov.in/j/1',
          summary: 'Regular bail under the successor to CrPC 437 was considered while investigation was pending.',
          decisionDate: new Date('2024-01-15'),
          judges: [],
          metadataPath: '2024_1_1',
        },
      ]),
      fetchJudgmentBody: jest.fn().mockResolvedValue({
        title: 'State of NCT of Delhi v Accused',
        citation: '(2024) 1 SCR 1',
        fullText:
          'The Court held that regular bail remains available when the investigation is pending and the accused is not a flight risk. '.repeat(
            4,
          ),
        sourceUrl: 'https://scr.sci.gov.in/j/1',
        court: 'Supreme Court of India',
        judges: [],
        decisionDate: new Date('2024-01-15'),
        treatmentHints: [],
        neutralCitation: '2024 INSC 1',
      }),
    };

    const service = new CaseLawRecoveryService(
      new IndiaKanoonQueryBuilderService(),
      discovery as never,
      new KenyaLawQueryBuilderService(),
      { retrieveAndIngest: jest.fn() } as never,
      { isConfigured: () => false, searchWithOutcome: jest.fn() } as never,
      escr as never,
    );

    const result = await service.recover({
      query: 'Whether regular bail under BNSS 480 should be granted while investigation is pending',
      countryCode: 'IN',
      legalIssues: ['regular bail pending investigation'],
      maxQueries: 4,
    });

    expect(escr.searchJudgmentsBroad).toHaveBeenCalled();
    expect(discovery.planCandidates).not.toHaveBeenCalled();
    expect(result.authorities.some((a) => a.sourceName === 'e-SCR')).toBe(true);
    expect(result.unverifiedLeads).toEqual([]);
    expect(result.diagnostics.some((d) => d.provider === 'e-scr-issue-search')).toBe(true);
  });
});
