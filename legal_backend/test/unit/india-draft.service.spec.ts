import { MatterResearchContextService } from '@/ai/legal-research/matter-research-context.service';
import { DraftKindPlaybookService } from '@/ai/drafting/playbooks/draft-kind-playbook.service';
import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { IndiaDraftService } from '@/ai/india-draft/india-draft.service';
import { LlmCompletionService } from '@/ai/llm-completion.service';
import { AiCreditEnforcementService } from '@/ai-credits/ai-credit-enforcement.service';
import { AICreditLedgerService } from '@/ai-credits/ai-credit-ledger.service';
import { AiUsageRecorderService } from '@/ai/ai-usage-recorder.service';
import { IndiaDraftGroundingService } from '@/ai/india-draft/india-draft-grounding.service';
import { IndiaDraftVerificationService } from '@/ai/india-draft/india-draft-verification.service';
import { DraftProceduralGateService } from '@/ai/drafting/draft-procedural-gate.service';
import { DraftProceduralRouterService } from '@/ai/drafting/draft-procedural-router.service';
import { DraftResearchGroundingService } from '@/ai/drafting/draft-research-grounding.service';
import { DraftingIntelligenceMapService } from '@/ai/drafting/drafting-intelligence-map.service';
import { DraftPreChecklistService } from '@/ai/drafting/draft-pre-checklist.service';
import { DraftAccuracyGateService } from '@/ai/drafting/draft-accuracy-gate.service';
import { UnifiedVerificationService } from '@/ai/verification/unified-verification.service';
import { CourtDraftHistoryService } from '@/ai/drafting/court-draft-history.service';
import { DraftStructuralReferenceService } from '@/ai/drafting/structural-references/reference-skeleton.service';
import { DraftStructureAuditService } from '@/ai/drafting/draft-structure-audit.service';
import { DocumentDependencyService } from '@/ai/matter-intelligence/document-dependency.service';
import { MatterIntelligencePipelineService } from '@/ai/matter-intelligence/matter-intelligence-pipeline.service';
import { SelectionTrackingService } from '@/ai/matter-intelligence/selection-tracking.service';

describe('IndiaDraftService', () => {
  let service: IndiaDraftService;
  let verification: { addVerifiedCitations: jest.Mock; verify: jest.Mock; buildVerificationExplanation: jest.Mock };
  let matterContext: { buildContext: jest.Mock };
  let documentDependency: { checkPreDraft: jest.Mock };

  beforeEach(async () => {
    matterContext = { buildContext: jest.fn().mockResolvedValue({ countryCode: 'IN', jurisdiction: 'Delhi', promptContext: 'Authorized multi-document context' }) };
    verification = {
      addVerifiedCitations: jest.fn().mockResolvedValue({
        revisedText: 'Passage with AIR 2010 SC 1 only.',
        explanation: 'Added verified citations.',
        audit: {
          corrections: [],
          similarCases: [],
          sectionChecks: { entries: [], anyCorrections: false, anyUnconfirmedMismatches: false },
          citationWarnings: [],
          strippedCitations: [],
          proceduralWarnings: [],
          completenessGaps: [],
          requiresLawyerReview: false,
          verificationStatus: 'verified',
        },
      }),
      verify: jest.fn(),
      buildVerificationExplanation: jest.fn().mockReturnValue('ok'),
    };

    documentDependency = {
      checkPreDraft: jest.fn().mockReturnValue({ canProceed: true, missingInputs: [] }),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        IndiaDraftService,
        { provide: MatterResearchContextService, useValue: matterContext },
        DraftKindPlaybookService,
        DraftProceduralRouterService,
        { provide: LlmCompletionService, useValue: { complete: jest.fn() } },
        {
          provide: AiCreditEnforcementService,
          useValue: { debitForTokenUsage: jest.fn().mockResolvedValue({ creditsDebited: 1 }) },
        },
        {
          provide: AICreditLedgerService,
          useValue: { assertAndDebit: jest.fn().mockResolvedValue({ creditsDebited: 1 }), assertSufficientBalance: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: AiUsageRecorderService,
          useValue: {
            recordAfterFlatDebit: jest.fn().mockResolvedValue({ chargedCredits: 1 }),
            recordTokenUsage: jest.fn().mockResolvedValue({ chargedCredits: 1 }),
          },
        },
        { provide: IndiaDraftGroundingService, useValue: { buildGroundingBlock: jest.fn().mockResolvedValue('') } },
        { provide: IndiaDraftVerificationService, useValue: verification },
        {
          provide: DraftProceduralGateService,
          useValue: { check: jest.fn().mockReturnValue({ proceduralWarnings: [], completenessGaps: [] }), buildPromptBlock: jest.fn().mockReturnValue('') },
        },
        {
          provide: DraftResearchGroundingService,
          useValue: {
            buildGrounding: jest.fn().mockResolvedValue({
              authorities: [],
              verifiedAuthoritiesBlock: 'VERIFIED AUTHORITIES:\n(none)',
              retrievalConfidence: 'low',
              usedDeepResearch: false,
            }),
          },
        },
        {
          provide: DraftingIntelligenceMapService,
          useValue: {
            buildMap: jest.fn().mockResolvedValue({
              issues: [],
              likelyStatutes: [],
              researchQueries: [],
              searchHints: [],
              raw: {},
            }),
          },
        },
        {
          provide: CourtDraftHistoryService,
          useValue: { save: jest.fn().mockResolvedValue({ id: 'saved-1' }) },
        },
        {
          provide: DraftPreChecklistService,
          useValue: {
            evaluate: jest.fn().mockResolvedValue({
              checklist: { court_identified: true },
              resolvedItems: ['Court: Gujarat HC'],
              unresolvedItems: [],
              promptBlock: 'PRE-DRAFT CHECKLIST',
            }),
          },
        },
        {
          provide: DraftAccuracyGateService,
          useValue: {
            evaluate: jest.fn().mockReturnValue({
              canCertify: true,
              canExport: true,
              certificationLabel: 'verified_for_filing',
              unresolvedFacts: [],
            }),
          },
        },
        {
          provide: UnifiedVerificationService,
          useValue: {
            runChecks: jest.fn(),
            buildCorrectionPrompt: jest.fn(),
            shouldRegenerate: jest.fn().mockReturnValue(false),
          },
        },
        {
          provide: DraftStructuralReferenceService,
          useValue: { buildPromptBlock: jest.fn().mockReturnValue('') },
        },
        {
          provide: DraftStructureAuditService,
          useValue: { audit: jest.fn().mockReturnValue([]) },
        },
        { provide: DocumentDependencyService, useValue: documentDependency },
        {
          provide: MatterIntelligencePipelineService,
          useValue: { run: jest.fn().mockResolvedValue({ profile: {} }) },
        },
        {
          provide: SelectionTrackingService,
          useValue: { track: jest.fn() },
        },
      ],
    }).useMocker(() => ({})).compile();

    service = moduleRef.get(IndiaDraftService);
  });

  it('routes add_citations to verified citation pipeline instead of free-form LLM edit', async () => {
    const result = await service.editSelection(
      {
        documentKind: 'india_maintenance_application_bnss_144',
        selectedText: 'Maintenance application.',
        instruction: 'add_citations',
        caseDetails: 'Wife seeks maintenance',
      },
      { userId: 'user-1', tenantId: 'tenant-1' },
    );

    expect(verification.addVerifiedCitations).toHaveBeenCalledWith(
      expect.objectContaining({
        instruction: 'add_citations',
        selectedText: 'Maintenance application.',
      }),
    );
    expect(result.revisedText).toContain('AIR 2010 SC 1');
    expect(result.verification?.verificationStatus).toBe('verified');
  });

  it('blocks generateDraft when DocumentDependencyService reports missing inputs', async () => {
    documentDependency.checkPreDraft.mockReturnValue({
      canProceed: false,
      missingInputs: ['Termination Letter'],
      message: 'Please upload or reference the termination letter before drafting the petition.',
    });

    await expect(
      service.generateDraft(
        {
          kind: 'india_wrongful_termination',
          caseDetails: 'Employee terminated without notice.',
        },
        { userId: 'user-1', tenantId: 'tenant-1' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(documentDependency.checkPreDraft).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining(['Employee terminated without notice.']),
    );
  });
  it('rejects inaccessible matter context before any drafting', async () => {
    const denied = new Error('Ethical wall restriction');
    matterContext.buildContext.mockRejectedValue(denied);
    await expect(service.generateDraft({ kind: 'india_regular_bail_bnss_480', caseDetails: 'QA', matterId: 'restricted' },
      { userId: 'u1', tenantId: 't1' })).rejects.toBe(denied);
    expect(documentDependency.checkPreDraft).not.toHaveBeenCalled();
  });

  it('rejects a non-Indian matter instead of applying Indian law', async () => {
    matterContext.buildContext.mockResolvedValue({ countryCode: 'KE', promptContext: 'Kenyan matter' });
    await expect(service.generateDraft({ kind: 'india_regular_bail_bnss_480', caseDetails: 'QA', matterId: 'm1' },
      { userId: 'u1', tenantId: 't1' })).rejects.toBeInstanceOf(BadRequestException);
    expect(documentDependency.checkPreDraft).not.toHaveBeenCalled();
  });

  it('preserves authorized context, matter linkage and source selection through v2 routing', async () => {
    const state = service as any;
    const sentinel = new Error('Stop after routing');
    state.caseBriefService = { extract: jest.fn().mockReturnValue({ intakeIncomplete: false, missingCriticalFields: [] }) };
    state.cycleMarginGuard = { resolveEffectiveMode: jest.fn().mockResolvedValue({ effectiveMode: 'AUTO' }) };
    state.draftEngineV2 = { generate: jest.fn().mockRejectedValue(sentinel) };
    const previous = process.env.DRAFT_ENGINE_V2;
    process.env.DRAFT_ENGINE_V2 = 'true';
    try {
      await expect(service.generateDraft({ kind: 'india_regular_bail_bnss_480', caseDetails: 'Fictional supplied facts',
        matterId: 'm1', knowledgeSources: ['case_law'], attachmentContext: 'User attachment' },
        { userId: 'u1', tenantId: 't1', tenantRole: 'FIRM_ADMIN' })).rejects.toBe(sentinel);
      expect(state.draftEngineV2.generate).toHaveBeenCalledWith(expect.objectContaining({
        matterId: 'm1', knowledgeSources: ['case_law'], jurisdiction: 'Delhi',
        attachmentContext: 'Authorized multi-document context\n\nUser attachment',
      }), { userId: 'u1', tenantId: 't1', tenantRole: 'FIRM_ADMIN' });
    } finally {
      if (previous === undefined) delete process.env.DRAFT_ENGINE_V2;
      else process.env.DRAFT_ENGINE_V2 = previous;
    }
  });

});
