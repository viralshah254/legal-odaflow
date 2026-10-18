import { BadRequestException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ResearchAuthoritySearchDto } from '@/ai/dto/research-authority-search.dto';
import { ResearchRefineDto } from '@/ai/dto/research-refine.dto';
import { ResearchEnrichService } from './research-enrich.service';

jest.mock('p-limit', () => ({
  __esModule: true,
  default: () => (task: () => unknown) => task(),
}));

describe('ResearchEnrichService', () => {
  const authority = (id: string, title: string) => ({
    id,
    countryCode: 'IN',
    jurisdiction: null,
    authorityType: 'CASE_LAW',
    title,
    citation: `${id} SCC 1`,
    neutralCitation: null,
    court: null,
    courtLevel: null,
    decisionDate: new Date('2024-01-01'),
    sourceUrl: `https://example.test/${id}`,
    sourceName: 'Supreme Court of India',
    sourceLicense: null,
    fullText: `${title} held that the stated legal test applies.`,
    summary: `${title} summary`,
    holding: null,
    topics: [],
    practiceAreas: [],
    draftKinds: [],
    embeddingStatus: 'READY',
    treatmentStatus: 'good_law',
    reviewedByHuman: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    isRepealed: false,
    repealNotes: null,
  });

  function setup() {
    const tx = {
      aIOutput: { update: jest.fn().mockResolvedValue({}) },
      aICitation: {
        deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
    };
    const prisma = {
      aIOutput: { findFirst: jest.fn(), update: jest.fn().mockResolvedValue({}) },
      legalAuthority: { findMany: jest.fn() },
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const draft = {
      directAnswer: { text: 'Refined answer', confidence: 0.8 },
      issues: [],
      practicalSteps: [],
      limitations: [],
      unansweredQuestions: [],
    };
    const structuredSynthesis = {
      synthesize: jest.fn().mockResolvedValue({
        outputMarkdown: '## Direct Answer\n\nRefined answer',
        draft,
        usedStructuredPlan: true,
        verificationUnavailable: false,
        findings: [],
        usage: { inputTokens: 100, outputTokens: 50 },
      }),
    };
    const verification = {
      verifyAndPublish: jest.fn().mockResolvedValue({
        outputMarkdown: '## Direct Answer\n\nVerified refined answer',
        citations: [
          { authorityId: 'auth-1', title: 'Allowed Case', verified: true },
          { authorityId: 'added-1', title: 'Added Case', verified: true },
        ],
        provenance: {
          verificationStatus: 'passed',
          sourceTierSummary: 'case_law:2',
          requiresLawyerReview: true,
        },
        sentenceAudit: { entries: [], coverageRate: 1, ungroundedCount: 0 },
        regenerated: false,
        refusedSubstantiveClaims: false,
        findings: [],
        propositions: [],
        dimensions: {
          identity: { state: 'PASS', pass: 1, fail: 0, indeterminate: 0, notApplicable: 0 },
          passage: { state: 'PASS', pass: 1, fail: 0, indeterminate: 0, notApplicable: 0 },
          quotation: { state: 'NOT_APPLICABLE', pass: 0, fail: 0, indeterminate: 0, notApplicable: 1 },
          currentLaw: { state: 'PASS', pass: 1, fail: 0, indeterminate: 0, notApplicable: 0 },
          treatment: { state: 'PASS', pass: 1, fail: 0, indeterminate: 0, notApplicable: 0 },
          hierarchy: { state: 'PASS', pass: 1, fail: 0, indeterminate: 0, notApplicable: 0 },
        },
        publicationState: 'READY_FOR_LAWYER_REVIEW',
        outputHash: 'hash',
      }),
    };
    const evidencePackService = {
      buildFromAuthorities: jest.fn().mockReturnValue({
        evidencePackId: 'pack',
        version: 'v2',
        jurisdiction: 'IN',
        asOfDate: '2026-07-25',
        statutes: [],
        authorities: [],
        officialMaterials: [],
        sourceSnapshots: [],
        matterFacts: [],
        unresolvedGaps: [],
      }),
    };
    const creditLedger = { assertAndDebit: jest.fn().mockResolvedValue(undefined) };
    const tokenCreditCharge = {
      computeCreditsForUsage: jest.fn().mockResolvedValue({
        credits: 1,
        providerCostUsd: 0.01,
      }),
    };
    const retrievalOrchestrator = {
      retrieve: jest.fn(),
    };
    const ikEvidenceIngest = {
      retrieveAndIngest: jest.fn().mockResolvedValue({
        authorities: [],
        packDelta: [],
        queries: [],
        searchStatus: 'no_hits',
      }),
    };
    const similarCasesService = {
      extractAndRank: jest.fn((authorities: Array<{ id: string; title: string }>) =>
        authorities.map((item) => ({
          authorityId: item.id,
          title: item.title,
          citation: null,
          court: null,
          year: null,
          sourceUrl: null,
          sourceName: 'Test source',
          summary: null,
          relevantSections: [],
          relevance: 'matched',
          bindingWeight: 'persuasive',
          confidence: 0.7,
          verificationStatus: 'verified',
        })),
      ),
      buildPromptBlock: jest.fn().mockReturnValue(''),
    };
    const sectionFinderGrounding = {
      buildContext: jest.fn().mockResolvedValue({
        promptBlock: '',
        verifiedSectionLabels: [],
        authorities: [],
      }),
    };
    const llm = { complete: jest.fn() };
    const keEvidenceIngest = { retrieveAndIngest: jest.fn() };
    const service = new ResearchEnrichService(
      prisma as never,
      llm as never,
      creditLedger as never,
      tokenCreditCharge as never,
      retrievalOrchestrator as never,
      similarCasesService as never,
      sectionFinderGrounding as never,
      ikEvidenceIngest as never,
      keEvidenceIngest as never,
      verification as never,
      evidencePackService as never,
      structuredSynthesis as never,
    );
    return {
      service,
      prisma,
      tx,
      structuredSynthesis,
      verification,
      evidencePackService,
      creditLedger,
      tokenCreditCharge,
      retrievalOrchestrator,
      ikEvidenceIngest,
      similarCasesService,
      sectionFinderGrounding,
      llm,
    };
  }

  it('returns only relevance-gated evidence without persistence or credits', async () => {
    const {
      service,
      prisma,
      creditLedger,
      tokenCreditCharge,
      retrievalOrchestrator,
      ikEvidenceIngest,
    } = setup();
    retrievalOrchestrator.retrieve.mockResolvedValue({
      authorities: [
        {
          id: 'auth-bail',
          title: 'State v Applicant',
          citation: '2025 SCC 10',
          sourceName: 'Supreme Court of India',
          sourceUrl: 'https://example.test/bail',
          summary:
            'The Court considered anticipatory bail where witness intimidation was alleged.',
          fullText: null,
          sourceTier: 'case_law',
          score: 0.7,
        },
        {
          id: 'auth-tax',
          title: 'Revenue Commissioner v Company',
          citation: '2020 Tax 2',
          sourceName: 'Tax Court',
          sourceUrl: 'https://example.test/tax',
          summary: 'A corporate tax deduction dispute concerning depreciation.',
          fullText: null,
          sourceTier: 'case_law',
          score: 0.9,
        },
      ],
      isBareActQuery: false,
      confidence: 'medium',
      primaryTierCount: 0,
      queryHash: 'query-hash',
    });

    const result = await service.searchAuthorities({
      tenantId: 'tenant-1',
      userId: 'user-1',
      query: 'anticipatory bail witness intimidation',
      countryCode: 'IN',
      limit: 1,
    });

    expect(result.authorities).toEqual([
      expect.objectContaining({
        id: 'auth-bail',
        authorityId: 'auth-bail',
        summary: expect.stringContaining('anticipatory bail'),
        relevanceReason: expect.any(String),
      }),
    ]);
    expect(retrievalOrchestrator.retrieve).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        userId: 'user-1',
        countryCode: 'IN',
      }),
    );
    expect(ikEvidenceIngest.retrieveAndIngest).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(creditLedger.assertAndDebit).not.toHaveBeenCalled();
    expect(tokenCreditCharge.computeCreditsForUsage).not.toHaveBeenCalled();
  });

  it('uses bounded IK evidence ingest when India results are thin', async () => {
    const { service, retrievalOrchestrator, ikEvidenceIngest } = setup();
    retrievalOrchestrator.retrieve.mockResolvedValue({
      authorities: [],
      isBareActQuery: false,
      confidence: 'low',
      primaryTierCount: 0,
      queryHash: 'query-hash',
    });
    ikEvidenceIngest.retrieveAndIngest.mockResolvedValue({
      authorities: [
        {
          id: 'ik-101',
          title: 'Applicant v State',
          citation: '2026 INSC 101',
          sourceName: 'Supreme Court of India',
          sourceUrl: 'https://indiankanoon.org/doc/101/',
          summary: 'The judgment applies anticipatory bail safeguards.',
          fullText: 'The judgment applies anticipatory bail safeguards to the applicant.',
          sourceTier: 'case_law',
          relevanceScore: 0.8,
          relevanceReason: 'admitted: issue phrase matched',
        },
      ],
      packDelta: [],
      queries: ['anticipatory bail'],
      searchStatus: 'searched',
    });

    const result = await service.searchAuthorities({
      tenantId: 'tenant-1',
      userId: 'user-1',
      query: 'anticipatory bail safeguards',
      countryCode: 'IN',
      limit: 4,
    });

    expect(ikEvidenceIngest.retrieveAndIngest).toHaveBeenCalledWith(
      expect.objectContaining({
        maxQueries: 2,
        limitPerQuery: 4,
        skipProceduralQuery: true,
      }),
    );
    expect(result.authorities[0]).toEqual(
      expect.objectContaining({
        id: 'ik-101',
        authorityId: 'ik-101',
        sourceTier: 'case_law',
      }),
    );
  });

  it('loads the output through tenant-scoped ownership', async () => {
    const { service, prisma } = setup();
    prisma.aIOutput.findFirst.mockResolvedValue(null);

    await expect(
      service.refine({
        outputId: 'output-1',
        tenantId: 'tenant-1',
        userId: 'user-1',
        pinnedAuthorityIds: [],
        excludedAuthorityIds: [],
        addedAuthorities: [],
        addedContext: '',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.aIOutput.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'output-1', tenantId: 'tenant-1' }),
      }),
    );
  });

  it('returns a zero-charge no-op when retrieved evidence already exists', async () => {
    const {
      service,
      prisma,
      retrievalOrchestrator,
      creditLedger,
      tokenCreditCharge,
      llm,
    } = setup();
    const existingCase = {
      authorityId: 'case-1',
      title: 'Existing Case',
      citation: '(2024) 1 SCC 1',
      court: 'Supreme Court of India',
      year: '2024',
      sourceUrl: 'https://example.test/case-1',
      sourceName: 'Supreme Court of India',
      summary: 'Existing supported holding.',
      relevantSections: [],
      relevance: 'matched',
      bindingWeight: 'binding',
      confidence: 0.9,
      verificationStatus: 'verified',
    };
    prisma.aIOutput.findFirst.mockResolvedValue({
      id: 'output-1',
      tenantId: 'tenant-1',
      inputQuery: 'partnership arbitration clause',
      outputMarkdown: 'Existing memorandum.',
      jurisdiction: 'IN',
      citations: {
        items: [{ authorityId: 'case-1', title: 'Existing Case' }],
        similarCases: [existingCase],
      },
    });
    retrievalOrchestrator.retrieve.mockResolvedValue({
      authorities: [
        {
          id: 'case-1',
          title: 'Existing Case',
          citation: '(2024) 1 SCC 1',
          sourceName: 'Supreme Court of India',
          sourceUrl: 'https://example.test/case-1',
          summary: 'Existing supported holding.',
          fullText: 'Existing supported holding in a partnership arbitration dispute.',
          sourceTier: 'case_law',
        },
      ],
    });

    const result = await service.enrich({
      outputId: 'output-1',
      tenantId: 'tenant-1',
      userId: 'user-1',
      mode: 'case_laws',
      countryCode: 'IN',
    });

    expect(result.warning).toBe('ALREADY_SUFFICIENTLY_GROUNDED');
    expect(result.creditsCharged).toBe(0);
    expect(result.casesAdded).toBe(0);
    expect(result.similarCases).toEqual([existingCase]);
    expect(creditLedger.assertAndDebit).not.toHaveBeenCalled();
    expect(tokenCreditCharge.computeCreditsForUsage).not.toHaveBeenCalled();
    expect(llm.complete).not.toHaveBeenCalled();
  });

  it('re-synthesizes only from retained, pinned, and added authorities', async () => {
    const {
      service,
      prisma,
      tx,
      verification,
      evidencePackService,
      structuredSynthesis,
    } = setup();
    prisma.aIOutput.findFirst.mockResolvedValue({
      id: 'output-1',
      tenantId: 'tenant-1',
      inputQuery: 'original query',
      outputMarkdown: 'Old memo citing both cases.',
      jurisdiction: 'IN',
      citations: {
        items: [
          { authorityId: 'auth-1', title: 'Allowed Case' },
          { authorityId: 'auth-2', title: 'Excluded Case' },
        ],
        similarCases: [
          { authorityId: 'auth-1' },
          { authorityId: 'auth-2' },
        ],
      },
      aiCitations: [],
    });
    prisma.legalAuthority.findMany.mockResolvedValue([
      authority('auth-1', 'Allowed Case'),
      authority('auth-2', 'Excluded Case'),
    ]);

    const result = await service.refine({
      outputId: 'output-1',
      tenantId: 'tenant-1',
      userId: 'user-1',
      pinnedAuthorityIds: ['auth-1'],
      excludedAuthorityIds: ['auth-2'],
      addedAuthorities: [
        {
          id: 'added-1',
          title: 'Added Case',
          citation: '2025 SCC 2',
          sourceUrl: 'https://example.test/added',
          excerpt: 'The court stated a narrow additional rule.',
          sourceTier: 'case_law',
        },
      ],
      addedContext: 'A new material fact.',
      countryCode: 'IN',
      requestedTaskKind: 'CASE_SURVEY',
      desiredOutput: 'AUTHORITY_LIST',
    });

    const verificationInput = verification.verifyAndPublish.mock.calls[0][0];
    expect(verificationInput.authorities.map((item: { id: string }) => item.id)).toEqual([
      'auth-1',
      'added-1',
    ]);
    expect(verificationInput.fastMode).toBe(true);
    expect(evidencePackService.buildFromAuthorities).toHaveBeenCalledWith(
      expect.objectContaining({
        matterFacts: [
          expect.objectContaining({ description: 'A new material fact.' }),
        ],
      }),
    );
    expect(result.outputMarkdown).toContain('Verified refined answer');
    expect(structuredSynthesis.synthesize).toHaveBeenCalledWith(
      expect.objectContaining({ taskKind: 'CASE_SURVEY' }),
    );
    expect(result.structuredMemo.directAnswer.text).toBe('Refined answer');
    expect(result.citations).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ authorityId: 'auth-2' })]),
    );

    const persisted = tx.aIOutput.update.mock.calls[0][0].data;
    expect(persisted.citations.refinement.selectedAuthorityIds).toEqual([
      'auth-1',
      'added-1',
    ]);
    expect(tx.aICitation.createMany.mock.calls[0][0].data).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ authorityId: 'auth-2' })]),
    );
  });

  it('rejects manually added authorities without evidence text', async () => {
    const { service, prisma } = setup();
    prisma.aIOutput.findFirst.mockResolvedValue({
      id: 'output-1',
      tenantId: 'tenant-1',
      inputQuery: 'query',
      outputMarkdown: 'memo',
      jurisdiction: 'IN',
      citations: { items: [] },
      aiCitations: [],
    });
    prisma.legalAuthority.findMany.mockResolvedValue([]);

    await expect(
      service.refine({
        outputId: 'output-1',
        tenantId: 'tenant-1',
        userId: 'user-1',
        pinnedAuthorityIds: [],
        excludedAuthorityIds: [],
        addedAuthorities: [{ title: 'Metadata-only source' }],
        addedContext: '',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('ResearchRefineDto', () => {
  it('validates nested authorities and array bounds', async () => {
    const dto = plainToInstance(ResearchRefineDto, {
      pinnedAuthorityIds: [],
      excludedAuthorityIds: [],
      addedAuthorities: [
        {
          title: 'Added authority',
          sourceUrl: 'not-a-url',
          excerpt: 'Evidence text',
        },
      ],
      addedContext: '',
    });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'addedAuthorities')).toBe(true);
  });

  it('accepts preserved adaptive intent fields', async () => {
    const dto = plainToInstance(ResearchRefineDto, {
      pinnedAuthorityIds: [],
      excludedAuthorityIds: [],
      addedAuthorities: [],
      addedContext: 'Focus on the disputed clause.',
      requestedTaskKind: 'CASE_SURVEY',
      desiredOutput: 'AUTHORITY_LIST',
      countryCode: 'IN',
      jurisdiction: 'Maharashtra',
    });
    expect(await validate(dto)).toEqual([]);
  });
});

describe('ResearchAuthoritySearchDto', () => {
  it('rejects limits above the response cap', async () => {
    const dto = plainToInstance(ResearchAuthoritySearchDto, {
      query: 'anticipatory bail',
      countryCode: 'IN',
      limit: 9,
    });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'limit')).toBe(true);
  });
});
