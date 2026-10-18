import { DraftIntentService } from '@/ai/draft-intent/draft-intent.service';
import { MatterClarificationService } from '@/ai/draft-intent/matter-clarification.service';
import { PlaybookResolverService } from '@/ai/draft-intent/playbook-resolver.service';
import { ExplicitDocumentResolverService } from '@/ai/draft-intent/explicit-document-resolver.service';
import { LegalFormsSearchService } from '@/legal-forms/legal-forms-search.service';
import { PrismaService } from '@/prisma/prisma.service';
import type { JurisdictionForm } from '@prisma/client';

describe('DraftIntentService', () => {
  const dvQuery =
    'I was attacked by my husband, I need to draft a complaint about domestic violence';

  const c1a = {
    id: 'form-c1a',
    formName: 'Allegations of Harm and Domestic Violence',
    formNumber: 'C1A',
    authority: 'HM Courts & Tribunals Service',
    description: 'Family court form',
    practiceArea: 'FAMILY_MATRIMONIAL',
    category: 'Family',
    countryCode: 'GB',
    jurisdiction: 'England & Wales',
    sourceUrl: 'https://example.com',
    feeInfo: null,
    lastUpdated: null,
    isSystem: true,
    tenantId: null,
    createdAt: new Date(),
  } as JurisdictionForm;

  function createService() {
    const legalFormsSearch = {
      searchByIntent: jest.fn().mockResolvedValue([
        {
          form: c1a,
          combinedScore: 0.82,
          vectorScore: 0.85,
          lexicalScore: 0.75,
        },
      ]),
    } as unknown as LegalFormsSearchService;

    const prisma = {
      tenant: {
        findUnique: jest.fn().mockResolvedValue({ primaryCountry: 'GB' }),
      },
      documentTemplate: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      systemDocumentTemplate: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    } as unknown as PrismaService;

    const creditLedger = {
      assertAndDebit: jest.fn().mockResolvedValue({
        creditsDebited: 2,
        balanceAfter: 48,
      }),
      getBalance: jest.fn().mockResolvedValue(50),
    } as unknown as import('@/ai-credits/ai-credit-ledger.service').AICreditLedgerService;

    const matterPipeline = {
      run: jest.fn().mockResolvedValue({
        profile: {
          country: 'GB',
          practiceArea: 'family_matrimonial',
          nature: 'dispute',
          remedies: [],
          issues: [],
          documentTypes: [],
          curatedKinds: [],
          confidence: 0.9,
          documentKind: 'protective_injunction',
        },
        clarifyingQuestions: [],
        shouldProceed: true,
        recommendationMode: 'matched',
      }),
    } as unknown as import('@/ai/matter-intelligence/matter-intelligence-pipeline.service').MatterIntelligencePipelineService;

    const selectionTracking = {
      profileHash: jest.fn().mockReturnValue('hash'),
      record: jest.fn().mockResolvedValue(undefined),
    } as unknown as import('@/ai/matter-intelligence/selection-tracking.service').SelectionTrackingService;
    const outcomeProfile = {
      getForProfile: jest.fn().mockResolvedValue({
        sampleSize: 0,
        practiceArea: 'family_matrimonial',
        commonDocuments: [],
      }),
    } as unknown as import('@/ai/matter-intelligence/outcome-profile.service').OutcomeProfileService;
    const clarification = new MatterClarificationService();
    const playbookResolver = new PlaybookResolverService();
    const explicitDocumentResolver = {
      resolve: jest.fn().mockResolvedValue({
        hasExplicitSection: false,
        bundle: [],
        resolutions: [],
        unmapped: [],
      }),
    } as unknown as ExplicitDocumentResolverService;

    return {
      service: new DraftIntentService(
        legalFormsSearch,
        prisma,
        creditLedger,
        matterPipeline,
        selectionTracking,
        outcomeProfile,
        clarification,
        playbookResolver,
        explicitDocumentResolver,
      ),
      legalFormsSearch,
      prisma,
      creditLedger,
    };
  }

  it('returns C1A as top match and avoids Service Agreement for DV complaint', async () => {
    const { service } = createService();
    const result = await service.resolve({
      query: dvQuery,
      tenantId: 'tenant-1',
      userId: 'user-1',
      countryCode: 'GB',
    });

    expect(result.classification.documentKind).toBe('protective_injunction');
    expect(result.classification.intent).toBe('filing');
    expect(result.matches[0].type).toBe('official_form');
    expect(result.matches[0].summary).toContain('C1A');
    expect(result.matches.some((m) => /Service Agreement/i.test(m.summary ?? ''))).toBe(false);
  });
});
