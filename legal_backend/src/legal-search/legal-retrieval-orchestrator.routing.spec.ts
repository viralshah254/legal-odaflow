import { IndiaKanoonQueryBuilderService } from '@/ai/legal-research/india-kanoon-query-builder.service';
import { KenyaLawQueryBuilderService } from '@/ai/legal-research/kenya-law-query-builder.service';
import { LegalRetrievalOrchestrator } from './legal-retrieval-orchestrator.service';

jest.mock('p-limit', () => ({
  __esModule: true,
  default:
    () =>
    <T>(operation: () => Promise<T>): Promise<T> =>
      operation(),
}));

function buildOrchestrator(options?: {
  indiaKanoon?: Record<string, unknown>;
  rbi?: Record<string, unknown>;
  licensed?: Record<string, unknown>;
  kenyaLaw?: Record<string, unknown>;
}) {
  return new LegalRetrievalOrchestrator(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    (options?.indiaKanoon ?? {
      isConfigured: () => false,
      isCircuitOpen: () => false,
    }) as never,
    { isConfigured: () => false } as never,
    { isConfigured: () => false } as never,
    (options?.kenyaLaw ?? {
      searchJudgments: jest.fn().mockResolvedValue([]),
      searchLegislation: jest.fn().mockResolvedValue([]),
    }) as never,
    {
      isConfigured: () => false,
      isCircuitOpen: () => false,
    } as never,
    {
      scheduleIndiaKanoonPersist: jest.fn(),
      scheduleKenyaPersist: jest.fn(),
    } as never,
    { get: jest.fn().mockReturnValue(undefined) } as never,
    (options?.rbi ?? {
      search: jest.fn().mockResolvedValue([]),
      isCircuitOpen: () => false,
    }) as never,
    new IndiaKanoonQueryBuilderService(),
    new KenyaLawQueryBuilderService(),
    null,
    (options?.licensed ?? null) as never,
  );
}

describe('LegalRetrievalOrchestrator live source routing', () => {
  it('routes UPI case-law research through doctypes-filtered IK queries', async () => {
    const rawQuestion =
      'My client says a UPI transfer was unauthorised. Please write a detailed essay explaining every possible remedy and all facts.';
    const search = jest.fn().mockResolvedValue({
      status: 'searched',
      results: [],
      hitCount: 0,
    });
    const orchestrator = buildOrchestrator({
      indiaKanoon: {
        isConfigured: () => true,
        isCircuitOpen: () => false,
        searchWithOutcome: search,
      },
    });

    await (orchestrator as any).supplementWithLiveConnectors([], {
      countryCode: 'IN',
      query: rawQuestion,
      searchQueries: [rawQuestion],
      isFastMode: true,
      forceCaseLaw: true,
      knowledgeSources: ['case_law'],
      legalIssues: ['unauthorised UPI transfer customer liability'],
    });

    const queries = search.mock.calls.map(([call]) => call.query as string);
    expect(queries.length).toBeGreaterThan(0);
    expect(queries.length).toBeLessThanOrEqual(2);
    expect(
      queries.every((query) =>
        /doctypes:(?:judgments|supremecourt)/.test(query),
      ),
    ).toBe(true);
    expect(queries).not.toContain(rawQuestion);
  });

  it('maps RBI results as regulation authorities for regulations-only retrieval', async () => {
    const search = jest.fn().mockResolvedValue([
      {
        id: 'rbi-digital-lending-directions-2025',
        title: 'Reserve Bank of India (Digital Lending) Directions, 2025',
        regulator: 'Reserve Bank of India',
        instrumentType: 'DIRECTION',
        instrumentNumber: 'DOR.STR.REC.19/21.07.001/2025-26',
        issueDate: '2025-05-08',
        decisionDate: '2025-05-08',
        sourceUrl: 'https://www.rbi.org.in/Scripts/NotificationUser.aspx?Id=12848&Mode=0',
        authorityType: 'REGULATION',
        fullText: 'Digital lending directions '.repeat(30),
        paragraphReferences: [],
        topics: ['digital lending'],
      },
    ]);
    const orchestrator = buildOrchestrator({
      rbi: { search, isCircuitOpen: () => false },
    });

    const results = await (orchestrator as any).supplementWithLiveConnectors([], {
      countryCode: 'IN',
      query: 'digital lending directions',
      isFastMode: true,
      knowledgeSources: ['regulations'],
    });

    expect(results).toEqual([
      expect.objectContaining({
        authorityType: 'REGULATION',
        regulator: 'Reserve Bank of India',
        instrumentType: 'DIRECTION',
        sourceTier: 'primary',
      }),
    ]);
  });

  it('uses configured licensed India case law and applies the common relevance gate', async () => {
    const search = jest.fn().mockResolvedValue([
      {
        id: 'scc-partnership-1',
        title: 'Partner A v Partner B',
        citation: '(2020) 1 SCC 1',
        neutralCitation: null,
        court: 'Supreme Court',
        sourceUrl: 'https://licensed.example/case/1',
        summary: 'The Court enforced an arbitration clause in a partnership deed.',
        fullText: 'The partnership deed contained a binding arbitration clause.',
        practiceAreas: ['arbitration'],
        provider: 'scc',
      },
    ]);
    const orchestrator = buildOrchestrator({
      licensed: {
        isConfigured: () => true,
        configuredProviders: () => ['scc'],
        search,
      },
    });

    const results = await (orchestrator as any).supplementWithLiveConnectors([], {
      countryCode: 'IN',
      query: 'similar cases enforcing arbitration clauses in partnership deeds',
      isFastMode: true,
      forceCaseLaw: true,
      knowledgeSources: ['case_law'],
      legalIssues: ['enforcement of arbitration clauses in partnership deeds'],
      requestedAuthorityTypes: ['CASE_LAW'],
    });

    expect(search).toHaveBeenCalled();
    expect(results).toEqual([
      expect.objectContaining({
        sourceName: 'SCC Online',
        sourceTier: 'case_law',
        relevanceGate: 'admitted',
        courtTierRank: 0,
      }),
    ]);
  });

  it('stops issuing India Kanoon queries after unauthorized/circuit_open in the same run', async () => {
    let calls = 0;
    const searchWithOutcome = jest.fn().mockImplementation(async () => {
      calls += 1;
      return {
        status: 'unauthorized',
        results: [],
        hitCount: 0,
        errorMessage: 'HTTP 403',
      };
    });
    let circuitOpen = false;
    const orchestrator = buildOrchestrator({
      indiaKanoon: {
        isConfigured: () => true,
        isCircuitOpen: () => circuitOpen,
        searchWithOutcome: async (params: { query: string }) => {
          const outcome = await searchWithOutcome(params);
          circuitOpen = true;
          return outcome;
        },
      },
    });
    const diagnostics: Array<{ provider?: string; status?: string }> = [];

    await (orchestrator as any).supplementWithLiveConnectors([], {
      countryCode: 'IN',
      query: 'employee surveillance dismissal case law India',
      searchQueries: ['employee surveillance dismissal', 'workplace AI monitoring judgment'],
      isFastMode: false,
      forceCaseLaw: true,
      knowledgeSources: ['case_law'],
      legalIssues: ['unfair dismissal based on AI surveillance'],
      diagnostics,
    });

    expect(calls).toBe(1);
    expect(diagnostics.some((d) => d.status === 'unauthorized' || d.status === 'circuit_open')).toBe(
      true,
    );
  });

  it('hydrates Kenya Law search hits with full judgment text and normalized courts', async () => {
    const fetchJudgmentBody = jest.fn().mockResolvedValue({
      court: 'Employment and Labour Relations Court (KEELRC)',
      fullText: 'The court considered unfair termination and the statutory hearing requirement. '.repeat(
        3,
      ),
    });
    const searchLegislation = jest.fn().mockResolvedValue([]);
    const orchestrator = buildOrchestrator({
      kenyaLaw: {
        searchJudgments: jest.fn().mockResolvedValue([
          {
            id: 'ke-employment-1',
            title: 'Worker v Employer',
            citation: '[2025] KEELRC 12 (KLR)',
            court: 'KEELRC',
            sourceUrl: 'https://new.kenyalaw.org/akn/ke/judgment/keelrc/2025/12',
            summary: 'The court considered unfair termination and a statutory hearing.',
          },
        ]),
        searchLegislation,
        fetchJudgmentBody,
      },
    });

    const results = await (orchestrator as any).supplementWithLiveConnectors([], {
      countryCode: 'KE',
      query: 'unfair employment termination statutory hearing',
      searchQueries: ['unfair employment termination statutory hearing'],
      isFastMode: true,
      forceCaseLaw: true,
      knowledgeSources: ['case_law'],
      legalIssues: ['unfair employment termination statutory hearing'],
    });

    expect(fetchJudgmentBody).toHaveBeenCalled();
    expect(results).toEqual([
      expect.objectContaining({
        fullText: expect.stringContaining('statutory hearing requirement'),
        court: 'Employment and Labour Relations Court of Kenya',
        courtTierRank: 2,
        sourceName: 'Kenya Law',
      }),
    ]);
  });

  it('searches Kenya Law legislation when statutes are requested', async () => {
    const searchJudgments = jest.fn().mockResolvedValue([]);
    const searchLegislation = jest.fn().mockResolvedValue([
      {
        id: 'ke-doc-dpa',
        docType: 'legislation',
        title: 'Data Protection Act, 2019',
        citation: 'Act No. 24 of 2019',
        court: null,
        sourceUrl: 'https://new.kenyalaw.org/akn/ke/act/2019/24',
        summary: 'Principles of data protection and rights of data subjects.',
      },
    ]);
    const orchestrator = buildOrchestrator({
      kenyaLaw: {
        searchJudgments,
        searchLegislation,
        fetchJudgmentBody: jest.fn(),
      },
    });

    const results = await (orchestrator as any).supplementWithLiveConnectors([], {
      countryCode: 'KE',
      query: 'Data Protection Act CRB listing accuracy',
      searchQueries: ['Data Protection Act CRB listing'],
      isFastMode: true,
      knowledgeSources: ['statutes', 'case_law'],
      statuteSections: ['Data Protection Act 2019'],
      legalIssues: ['unlawful processing of personal data CRB'],
    });

    expect(searchLegislation).toHaveBeenCalled();
    expect(results.some((r: { authorityType?: string }) => r.authorityType === 'STATUTE')).toBe(
      true,
    );
  });
});
