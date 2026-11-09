import { MatterResearchContextService } from '@/ai/legal-research/matter-research-context.service';
import { Injectable, BadRequestException, Logger, Optional } from '@nestjs/common';
import { PromptInjectionService } from '@/ai/feedback/prompt-injection.service';
import { DraftVerificationOutcomeService } from '@/ai/feedback/draft-verification-outcome.service';
import { DraftCorrectionService } from '@/ai/feedback/draft-correction.service';
import { buildDraftLanguageInstruction } from '@/config/locales';
import { AiCreditEnforcementService } from '@/ai-credits/ai-credit-enforcement.service';
import { AICreditLedgerService } from '@/ai-credits/ai-credit-ledger.service';
import { AiUsageRecorderService } from '@/ai/ai-usage-recorder.service';
import { AI_TASK_TYPES } from '@/ai-credits/task-types';
import { computeCreditsFromProviderCost, estimateTokenCostUsd } from '@/ai-credits/credit-pricing.util';
import { LlmCompletionService } from '../llm-completion.service';
import { DEFAULT_AUTO_MODEL, DEFAULT_ECONOMY_MODEL, DRAFT_PREMIUM_MODEL, DRAFT_ENRICH_MODEL, getModelCostSync } from '../model-costs.config';
import type { LlmSystemBlock } from '../llm-completion.service';
import {
  FillBlanksDto,
  EditIndiaDraftDto,
  ExportIndiaDraftDto,
  FixVerificationDto,
  GenerateIndiaDraftDto,
  RegenerateSectionDto,
  ResolveCaseLawDto,
  ReverifyIndiaDraftDto,
  type EditIndiaDraftResult,
  type GenerateIndiaDraftResult,
  type ReverifyIndiaDraftResult,
} from './india-draft.dto';
import type { SectionResult } from '@/ai/drafting-v2/drafting-v2.types';
import { INDIA_DRAFT_SYSTEM_PROMPTS } from './india-draft-prompts';
import { buildIndiaCatalogFormPrompt } from './india-catalog-prompt.factory';
import { ensureIndiaDraftKind, isExplicitIndiaCatalogKind, resolveIndiaDraftFormatPrompt } from './india-draft-kind.utils';
import { caseLawPromptBlock, isHybridNoticeWithCaseLaw, wantsCaseLaw } from '@/ai/drafting/draft-citation-policy';
import { buildLegalTerminologyBlock } from '@/ai/drafting/legal-latin-corpus';
import { IndiaDraftGroundingService } from './india-draft-grounding.service';
import { IndiaDraftVerificationService } from './india-draft-verification.service';
import { LEGAL_ACCURACY_PROTOCOL, INDIA_COURT_PLEADING_PROTOCOL } from '@/ai/drafting/legal-accuracy-protocol';
import { DraftPreChecklistService } from '@/ai/drafting/draft-pre-checklist.service';
import { DraftAccuracyGateService } from '@/ai/drafting/draft-accuracy-gate.service';
import { DraftAccuracyOrchestratorService } from '@/ai/drafting/accuracy/draft-accuracy-orchestrator.service';
import { resolveBundleResearchMemoKind } from '@/ai/drafting/draft-kind.util';
import { buildCaseRecordPromptBlock } from '@/ai/drafting/accuracy/case-record-prompt.util';
import { CaseRecordExtractionService } from '@/ai/drafting/platform/case-record-extraction.service';
import { UnifiedVerificationService } from '@/ai/verification/unified-verification.service';
import { DraftProceduralGateService } from '@/ai/drafting/draft-procedural-gate.service';
import { DraftProceduralRouterService } from '@/ai/drafting/draft-procedural-router.service';
import {
  DraftResearchGroundingService,
  type DraftResearchGroundingResult,
} from '@/ai/drafting/draft-research-grounding.service';
import { DraftingIntelligenceMapService } from '@/ai/drafting/drafting-intelligence-map.service';
import { CourtDraftHistoryService } from '@/ai/drafting/court-draft-history.service';
import { renderDocumentHtml } from '@/ai/drafting/document-style-renderer';
import type { DraftVerificationAudit } from '@/ai/drafting/draft-verification.types';
import {
  authoritiesOnPointForKind,
} from '@/ai/drafting/draft-legal-blocklist';
import { DraftStructuralReferenceService } from '@/ai/drafting/structural-references/reference-skeleton.service';
import { DraftStructureAuditService } from '@/ai/drafting/draft-structure-audit.service';
import { DocumentDependencyService } from '@/ai/matter-intelligence/document-dependency.service';
import { MatterIntelligencePipelineService } from '@/ai/matter-intelligence/matter-intelligence-pipeline.service';
import { SelectionTrackingService } from '@/ai/matter-intelligence/selection-tracking.service';
import { isMiEnabled } from '@/ai/matter-intelligence/mi-feature-flags';
import { resolveMatterDocumentKind } from '@/config/templates/document-kinds';
import { isExpressIndiaDraftKind } from './india-draft-express';
import { DraftEngineV2Service, isDraftEngineV2Enabled, shouldUseV2ForKind } from '@/ai/drafting-v2/draft-engine-v2.service';
import { DraftingV2ShadowService, isDraftEngineV2ShadowEnabled, shouldRunShadowEvaluation } from '@/ai/drafting-v2/drafting-v2-shadow.service';
import { CitationAppendixBuilderService } from '@/ai/citations/citation-appendix-builder.service';
import { requiresCaseLawCitations } from '@/ai/drafting/draft-citation-policy';
import { DraftComplexityService } from '@/ai/drafting-v2/draft-complexity.service';
import { AiCycleMarginGuardService } from '@/ai/costs/ai-cycle-margin-guard.service';
import { getDraftCreditFloor } from '@/ai-credits/credit-costs';
import { LegalSectionRouterService } from '@/ai/legal-section-router.service';
import { DraftArchetypeRouterService } from '@/ai/drafting/archetypes/draft-archetype-router.service';
import { DraftFactFidelityService } from '@/ai/drafting/draft-fact-fidelity.service';
import { DraftCaseBriefService } from '@/ai/drafting/draft-case-brief.service';
import { DraftCaseFactCoverageService } from '@/ai/drafting/draft-case-fact-coverage.service';
import { DraftKindPlaybookService } from '@/ai/drafting/playbooks/draft-kind-playbook.service';
import { DraftProceduralTimelineValidator } from '@/ai/drafting/draft-procedural-timeline.validator';
import { DraftIntakeExtractionService } from '@/ai/drafting/draft-intake-extraction.service';
import { DraftPropositionPlanService } from '@/ai/drafting/draft-proposition-plan.service';
import { DraftCaseTheoryService } from '@/ai/drafting/draft-case-theory.service';
import { DraftArgumentGraphService } from '@/ai/drafting/draft-argument-graph.service';
import { DraftCoherenceReviewService } from '@/ai/drafting/draft-coherence-review.service';
import { authoritiesToVerifiedSources as toVerifiedSources } from '@/ai/drafting/authority-to-verified-source';
import { LegalEvidencePackService } from '@/ai/legal-research/legal-evidence-pack.service';
import { isPoliceComplaintRegister } from '@/ai/drafting/draft-legal-register.service';
import { DraftAuthorityVerificationService } from '@/ai/unified-drafting/verification/draft-authority-verification.service';
import {
  buildAuthorityEvidenceBundle,
  registryFromRetrievedAuthorities,
} from '@/ai/legal-research/authority-evidence-bundle';

const DU_COURT_DRAFTING_RULES = `
${LEGAL_ACCURACY_PROTOCOL}
${INDIA_COURT_PLEADING_PROTOCOL}

You are an expert Indian legal drafter trained on the University of Delhi's 2025 course
"Drafting, Pleadings and Conveyance" (LB-502). The following rules govern all drafting:

1. Every pleading must state facts and not law.
2. It must state all material facts and material facts only.
3. It must state only the facts on which the party relies, not evidence.
4. It must state facts concisely, but with precision and certainty.
5. Always use the language of the statute or document itself, never invent new phrasing.
6. Use active voice wherever possible. Avoid use of pronouns like 'He', 'She', 'This'.
7. Always refer to parties as 'the Plaintiff', 'the Defendant', 'the Petitioner', etc.
8. Dates, sums, and numbers shall be expressed in figures.
9. Divide pleadings into consecutively numbered paragraphs.
10. For Indian court documents, always use "MOST RESPECTFULLY SHOWETH:" to begin the body.
11. For BNSS 2023 matters, use current section numbers (not old CrPC).
12. Never cite BNS for procedural or maintenance provisions — use BNSS. When citing predecessor CrPC sections, always pair with the correct BNSS successor from Schedule I.

FORMATTING (mandatory):
- UPPERCASE for court name and section headings (CAUSE TITLE, GROUNDS, PRAYER, VERIFICATION).
- Center the court name in the cause title block.
- Separate GROUNDS, PRAYER, and VERIFICATION as distinct sections.
- Use descriptive [BLANK] placeholders (e.g. [BLANK: interim order date]) not generic blanks.
`;

const DU_POLICE_COMPLAINT_RULES = `
${LEGAL_ACCURACY_PROTOCOL}

You are drafting a police-station complaint / FIR information under BNSS §173 (not a court pleading).

REGISTER RULES (mandatory):
1. Address: "To, The Station House Officer, [BLANK: police station]" — never "Hon'ble Police Station".
2. Do NOT use "MOST RESPECTFULLY SHOWETH", court cause-title, or "Respondent" party designators.
3. State material facts only — never invent CCTV, messages, witnesses, injuries, or dates.
4. Cite substantive offence sections only when grounded from facts/router; do not invent sections.
5. Do NOT assert "non-bailable" or "mandatory arrest" unless Schedule I / facts support it.
6. Prayer: register information under BNSS §173, investigate, provide FIR copy, lawful protection if necessary.
7. Keep the draft short (about 1–2 pages). Use [BLANK] for missing particulars.
8. For post–1 July 2024 conduct use BNS/BNSS; IPC/CrPC only as Schedule I predecessors.

FORMATTING: plain numbered paragraphs; clear heading with governing sections; short prayer.
`;

const DU_RESEARCH_MEMO_RULES = `
${LEGAL_ACCURACY_PROTOCOL}

You are drafting an internal Legal Research / Case Strategy Memorandum for counsel (NOT a court pleading).

REGISTER RULES (mandatory):
1. Do NOT write CAUSE TITLE, MOST RESPECTFULLY SHOWETH, PRAYER, VERIFICATION, Affidavit, or Memo of Parties as a pleading.
2. Do NOT use Petitioner / Respondent / Plaintiff / Defendant as party designators in a cause-title style.
3. For consumer / medical-negligence matters, refer to parties as Complainant and Opposite Party (or Client / potential Opposite Parties) when discussing the dispute.
4. Required structure: (1) Short answer / executive summary; (2) Issues framed; (3) Material facts (neutral, from CaseRecord only); (4) Applicable law and authorities (supporting AND adverse); (5) Analysis applying law to facts; (6) Practical next steps and limitations.
5. Fill known dates, names, amounts, and addresses from CaseRecord / intake. Use [BLANK: description] ONLY when truly missing.
6. Do NOT invent insurer claim denial, bad faith, doctor qualifications, employment relationships, conclusive negligence, conclusive absence of consent, forgery, or unsupported causation.
7. Cite CPA 2019 forum provisions correctly (§§34 / 47 / 51 / 35 as applicable). Do NOT cite CPA 1986 §2(1)(*) as current jurisdiction. Do NOT invent District Commission ₹1–10 crore pecuniary bands — flag needs_confirmation if valuation uncertain.
8. Qualify private expert opinions; distinguish recognised complications from alleged negligent technique.

FORMATTING: clear section headings (SHORT ANSWER, ISSUES, FACTS, ANALYSIS, AUTHORITIES, NEXT STEPS); numbered paragraphs under facts/analysis; no court caption block.
`;

function isResearchMemoKind(kind: string): boolean {
  return /research_memo|case_strategy|legal_research/i.test(kind);
}

function draftingRulesForKind(kind: string): string {
  if (isPoliceComplaintRegister(kind) || /fir_complaint|police_complaint/i.test(kind)) {
    return DU_POLICE_COMPLAINT_RULES;
  }
  if (isResearchMemoKind(kind)) {
    return DU_RESEARCH_MEMO_RULES;
  }
  return DU_COURT_DRAFTING_RULES;
}

/** Detect consumer / medical-negligence matter from kind or intake narrative. */
function hasConsumerMatterSignals(kind: string, caseDetails?: string): boolean {
  if (/consumer|medical_negligence|document_production/i.test(kind)) return true;
  const text = caseDetails ?? '';
  return /\b(consumer\s+commission|consumer\s+protection|deficiency\s+in\s+service|opposite\s+part(?:y|ies)|medical\s+negligence|informed\s+consent|gallbladder|cholecystectomy)\b/i.test(
    text,
  );
}

const VERIFICATION_FIX_NET_MARGIN_PERCENT = 20;
const VERIFICATION_FIX_MIN_CREDITS = 1;
const VERIFICATION_FIX_INSTRUCTIONS = new Set([
  'check_law',
  'add_citations',
  'retrieve_authority',
  'qualify_claim',
  'remove_claim',
]);

export interface DraftAuthContext {
  tenantRole?: string;
  userId: string;
  tenantId: string;
}

@Injectable()
export class IndiaDraftService {
  private readonly logger = new Logger(IndiaDraftService.name);

  constructor(
    private readonly llm: LlmCompletionService,
    private readonly creditEnforcement: AiCreditEnforcementService,
    private readonly creditLedger: AICreditLedgerService,
    private readonly usageRecorder: AiUsageRecorderService,
    private readonly grounding: IndiaDraftGroundingService,
    private readonly verification: IndiaDraftVerificationService,
    private readonly proceduralGate: DraftProceduralGateService,
    private readonly proceduralRouter: DraftProceduralRouterService,
    private readonly researchGrounding: DraftResearchGroundingService,
    private readonly draftingIntelligenceMap: DraftingIntelligenceMapService,
    private readonly draftHistory: CourtDraftHistoryService,
    private readonly preChecklist: DraftPreChecklistService,
    private readonly accuracyGate: DraftAccuracyGateService,
    private readonly accuracyOrchestrator: DraftAccuracyOrchestratorService,
    private readonly caseRecordExtraction: CaseRecordExtractionService,
    private readonly unifiedVerification: UnifiedVerificationService,
    private readonly structuralReference: DraftStructuralReferenceService,
    private readonly structureAudit: DraftStructureAuditService,
    private readonly documentDependency: DocumentDependencyService,
    private readonly matterPipeline: MatterIntelligencePipelineService,
    private readonly selectionTracking: SelectionTrackingService,
    private readonly draftEngineV2: DraftEngineV2Service,
    private readonly shadowService: DraftingV2ShadowService,
    private readonly citationAppendixBuilder: CitationAppendixBuilderService,
    private readonly draftComplexity: DraftComplexityService,
    private readonly cycleMarginGuard: AiCycleMarginGuardService,
    private readonly legalSectionRouter: LegalSectionRouterService,
    private readonly archetypeRouter: DraftArchetypeRouterService,
    private readonly factFidelity: DraftFactFidelityService,
    private readonly caseBriefService: DraftCaseBriefService,
    private readonly factCoverage: DraftCaseFactCoverageService,
    private readonly playbooks: DraftKindPlaybookService,
    private readonly timelineValidator: DraftProceduralTimelineValidator,
    private readonly intakeExtraction: DraftIntakeExtractionService,
    private readonly propositionPlan: DraftPropositionPlanService,
    private readonly caseTheory: DraftCaseTheoryService,
    private readonly argumentGraph: DraftArgumentGraphService,
    private readonly coherenceReview: DraftCoherenceReviewService,
    private readonly evidencePackService: LegalEvidencePackService,
    @Optional() private readonly promptInjection: PromptInjectionService | null,
    @Optional() private readonly verificationOutcomes: DraftVerificationOutcomeService | null,
    @Optional() private readonly draftCorrections: DraftCorrectionService | null,
    @Optional() private readonly draftAuthorityVerification: DraftAuthorityVerificationService | null,
    private readonly matterContext: MatterResearchContextService,
  ) {}

  private readonly FORMAT_SYSTEM_PROMPTS = INDIA_DRAFT_SYSTEM_PROMPTS;

  async generateDraft(
    dto: GenerateIndiaDraftDto,
    ctx: DraftAuthContext,
  ): Promise<GenerateIndiaDraftResult> {
    // Resolve authorization and document ACLs before any generation or retrieval.
    if (dto.matterId) {
      const context = await this.matterContext.buildContext(ctx, {
        matterId: dto.matterId,
        contextScope: 'MATTER',
        query: dto.caseDetails,
      });
      if (context?.countryCode !== 'IN') {
        throw new BadRequestException('This drafting route supports Indian matters only');
      }
      dto = {
        ...dto,
        jurisdiction: context.jurisdiction ?? dto.jurisdiction,
        attachmentContext: [context.promptContext, dto.attachmentContext].filter(Boolean).join('\n\n'),
      };
    }
    const preDraftGate = this.documentDependency.checkPreDraft(ensureIndiaDraftKind(dto.kind), [
      dto.caseDetails,
      dto.attachmentContext ?? '',
    ]);
    if (!preDraftGate.canProceed) {
      throw new BadRequestException({
        message: preDraftGate.message ?? 'Missing required inputs before drafting',
        missingInputs: preDraftGate.missingInputs,
      });
    }

    // Preflight intake gate for filing-grade kinds
    let routingKind = ensureIndiaDraftKind(dto.kind);
    if (dto.bundleMode && (dto.bundleIndex ?? 0) === 0) {
      routingKind = resolveBundleResearchMemoKind(routingKind, dto.caseDetails ?? '');
    }
    const playbook = this.playbooks.resolve(routingKind);
    const caseBrief = this.caseBriefService.extract(dto.caseDetails ?? '', routingKind);
    if (
      playbook.filingGrade &&
      caseBrief.intakeIncomplete &&
      caseBrief.missingCriticalFields.length > 0 &&
      !dto.bundleMode
    ) {
      throw new BadRequestException({
        code: 'INTAKE_INCOMPLETE',
        message: `Complete intake before generating a filing-grade draft. Missing: ${caseBrief.missingCriticalFields.join(', ')}`,
        missingCriticalFields: caseBrief.missingCriticalFields,
        caseBrief,
      });
    }

    // ── v2 engine routing: global flag OR per-kind routing for citation-heavy forms ──────
    const effectiveKindForRouting = routingKind;
    const useV2 = shouldUseV2ForKind(effectiveKindForRouting);
    const isPerKindV2 = !isDraftEngineV2Enabled() && useV2; // per-kind routing (not global flag)

    if (useV2) {
      let v2Result: Awaited<ReturnType<DraftEngineV2Service['generate']>> | null = null;
      try {
        // Apply cycle margin guard before v2 engine call
        const { effectiveMode: v2ModelMode } = await this.cycleMarginGuard.resolveEffectiveMode(
          { tenantId: ctx.tenantId, userId: ctx.userId },
          dto.modelMode ?? 'AUTO',
        );
        v2Result = await this.draftEngineV2.generate(
          {
            kind: dto.kind,
            caseDetails: dto.caseDetails,
            clientName: dto.clientName,
            courtName: dto.courtName,
            opposingParty: dto.opposingParty,
            jurisdiction: dto.jurisdiction,
            language: dto.language,
            formNumber: dto.formNumber,
            formTitle: dto.formTitle,
            authority: dto.authority,
            practiceArea: dto.practiceArea,
            category: dto.category,
            attachmentContext: dto.attachmentContext,
            label: dto.label,
            bundleMode: dto.bundleMode,
            bundleIndex: dto.bundleIndex,
            modelMode: v2ModelMode,
            pinnedSections: dto.pinnedSections,
            pinnedCaseLaws: dto.pinnedCaseLaws,
            matterId: dto.matterId,
            knowledgeSources: dto.knowledgeSources,
          },
          ctx,
        );
      } catch (v2Err) {
        if (isPerKindV2) {
          // Safe fallback: per-kind routing failed, let the v1 pipeline handle it.
          this.logger.warn(
            `v2 per-kind routing failed for ${dto.kind}, falling back to v1: ${v2Err instanceof Error ? v2Err.message : String(v2Err)}`,
          );
          v2Result = null;
        } else {
          // Global flag is on — propagate the error.
          throw v2Err;
        }
      }

      if (v2Result) {
        return {
          draft: v2Result.draft,
          creditsUsed: v2Result.creditsUsed,
          modelUsed: v2Result.modelUsed,
          verification: v2Result.verificationReport
            ? {
                corrections: [],
                similarCases: v2Result.similarCases ?? [],
                sectionChecks: { entries: [], anyCorrections: false, anyUnconfirmedMismatches: false },
                citationWarnings: v2Result.verificationReport.overallWarnings,
                strippedCitations: [],
                proceduralWarnings: [],
                completenessGaps: [],
                requiresLawyerReview: v2Result.verificationReport.requiresLawyerReview,
                verificationStatus: v2Result.verificationReport.status,
                canCertify: v2Result.verificationReport.canCertify,
                certificationLabel: v2Result.verificationReport.certificationLabel,
              }
            : undefined,
          draftId: v2Result.draftId,
          proceduralDetermination: v2Result.proceduralDetermination,
          researchPhase: v2Result.researchPhase,
          sections: v2Result.sections,
          confidenceReport: v2Result.confidenceReport,
          verificationReport: v2Result.verificationReport,
          citationAppendix: v2Result.citationAppendix,
          engineVersion: 'v2',
        };
      }
      // Fall through to v1 pipeline if v2 failed and per-kind routing allowed fallback.
    }
    // ── End v2 gate — legacy v1 pipeline continues below ─────────────────────

    const bundleSubsequent = Boolean(dto.bundleMode && (dto.bundleIndex ?? 0) > 0);
    // Limit continuation passes: simple/standard drafts rarely need them given the higher
    // initial token budget; only complex/PREMIUM drafts allow the full 3-pass max.
    // (Complexity not yet known here — re-evaluated after complexity classification below.)
    const maxContinuations = bundleSubsequent ? 1 : 3;

    const userKind = ensureIndiaDraftKind(dto.kind);
    const respectUserSelection = isExplicitIndiaCatalogKind(userKind);

    let miKindOverride: string | undefined;
    let miProfile: Awaited<ReturnType<MatterIntelligencePipelineService['run']>>['profile'] | undefined;
    if (
      isMiEnabled('indiaDraft') &&
      dto.caseDetails?.trim() &&
      !isExpressIndiaDraftKind(dto.kind) &&
      !bundleSubsequent
    ) {
      const miResult = await this.matterPipeline.run({
        facts: dto.caseDetails,
        countryCode: 'IN',
        jurisdiction: dto.jurisdiction,
        skipRetrieval: true,
        consumer: 'indiaDraft',
        targetDocumentKind: dto.kind,
      });
      miProfile = miResult.profile;
      const inferredKind = ensureIndiaDraftKind(
        miResult.profile.documentKind ?? miResult.profile.curatedKinds?.[0] ?? dto.kind,
      );
      if (!respectUserSelection) {
        miKindOverride = inferredKind;
      }
    }

    const structuredIntake = await this.intakeExtraction.extract({
      caseDetails: dto.caseDetails,
      countryCode: 'IN',
      documentKind: dto.kind,
    });
    const offenceDate = dto.offenceDate ?? structuredIntake.offenceDate;
    const filingDate = dto.filingDate;

    let routerResult = this.proceduralRouter.route({
      kind: respectUserSelection ? userKind : ensureIndiaDraftKind(miKindOverride ?? dto.kind),
      caseDetails: dto.caseDetails,
      countryCode: 'IN',
      courtName: dto.courtName,
      respectUserSelection,
    });
    const archetypeRoute = this.archetypeRouter.route({
      jurisdiction: 'IN',
      caseDetails: dto.caseDetails,
      documentKind: routerResult.recommendedKind,
      offenceDate,
      filingDate,
      forumIntent: structuredIntake.forumIntent,
    });
    if (
      !respectUserSelection &&
      archetypeRoute.matched &&
      archetypeRoute.recommendedKind &&
      archetypeRoute.recommendedKind !== routerResult.recommendedKind
    ) {
      routerResult = {
        ...routerResult,
        recommendedKind: archetypeRoute.recommendedKind,
        kindOverridden: true,
        maintainabilityNotes: [
          ...(routerResult.maintainabilityNotes ?? []),
          `Archetype router selected ${archetypeRoute.recommendedKind} (${archetypeRoute.entry?.id}).`,
        ],
        governingSections: this.mergeGoverningSections(
          routerResult.governingSections,
          archetypeRoute.governingSections,
        ),
      };
    } else if (archetypeRoute.governingSections.length > 0) {
      routerResult = {
        ...routerResult,
        governingSections: this.mergeGoverningSections(
          routerResult.governingSections,
          archetypeRoute.governingSections,
        ),
      };
    }
    const sectionRoute = this.legalSectionRouter.resolve({
      consumer: 'india_draft_v1',
      countryCode: 'IN',
      documentKind: routerResult.recommendedKind,
      rawFacts: dto.caseDetails,
      courtName: dto.courtName,
      offenceDate,
      filingDate,
    });
    routerResult = this.legalSectionRouter.enrichProceduralResult(routerResult, {
      consumer: 'india_draft_v1',
      countryCode: 'IN',
      documentKind: routerResult.recommendedKind,
      rawFacts: dto.caseDetails,
      courtName: dto.courtName,
      offenceDate,
      filingDate,
    });
    const effectiveKind = respectUserSelection ? userKind : routerResult.recommendedKind;


    const formatPrompt =
      dto.kind === 'india_form_catalog'
        ? buildIndiaCatalogFormPrompt({
            formNumber: dto.formNumber,
            formTitle: dto.formTitle,
            authority: dto.authority,
            jurisdiction: dto.jurisdiction,
            practiceArea: dto.practiceArea,
          })
        : resolveIndiaDraftFormatPrompt(effectiveKind, this.FORMAT_SYSTEM_PROMPTS);
    if (!formatPrompt && dto.kind !== 'india_custom') {
      this.logger.warn(
        `No format prompt for kind ${dto.kind} (effective: ${effectiveKind}); using india_custom fallback`,
      );
    }
    const resolvedFormatPrompt =
      formatPrompt ||
      resolveIndiaDraftFormatPrompt('india_custom', this.FORMAT_SYSTEM_PROMPTS);

    const langInstruction = buildDraftLanguageInstruction(dto.language);
    const gate = this.proceduralGate.check({
      kind: effectiveKind,
      caseDetails: dto.caseDetails,
      countryCode: 'IN',
      courtName: dto.courtName,
    });

    const expressMode = isExpressIndiaDraftKind(effectiveKind);
    const hybridNoticeCaseLaw = isHybridNoticeWithCaseLaw(effectiveKind, dto.caseDetails);

    // ── Complexity-aware model selection (v1 path) ─────────────────────────────
    // Serious (non-express standard/complex) drafts stay on Sol — do not
    // cycle-margin-downgrade those paths. Express/simple may still downgrade.
    const rawModelMode: 'AUTO' | 'PREMIUM' =
      dto.modelMode === 'PREMIUM' ? 'PREMIUM' : 'AUTO';
    const provisionalComplexity = this.draftComplexity.classify({
      kind: effectiveKind,
      caseDetails: dto.caseDetails,
      proceduralOverridden: routerResult.kindOverridden,
      modelMode: rawModelMode,
    });
    const seriousDraft =
      !expressMode &&
      (provisionalComplexity === 'standard' ||
        provisionalComplexity === 'complex' ||
        rawModelMode === 'PREMIUM');
    const modelMode: 'AUTO' | 'PREMIUM' = seriousDraft
      ? rawModelMode
      : (
          await this.cycleMarginGuard.resolveEffectiveMode(
            { tenantId: ctx.tenantId, userId: ctx.userId },
            rawModelMode,
          )
        ).effectiveMode === 'PREMIUM'
        ? 'PREMIUM'
        : 'AUTO';

    const docComplexity = this.draftComplexity.classify({
      kind: effectiveKind,
      caseDetails: dto.caseDetails,
      proceduralOverridden: routerResult.kindOverridden,
      modelMode,
    });

    // Resolve pass-1 model: non-express standard + complex use Sol.
    // Express/simple drafts use enrich/economy models.
    const economyModel = this.llm.isProviderConfigured('deepseek')
      ? DEFAULT_ECONOMY_MODEL
      : DEFAULT_AUTO_MODEL;

    const pass1Model = expressMode
      ? DRAFT_ENRICH_MODEL
      : docComplexity === 'complex' ||
          docComplexity === 'standard' ||
          modelMode === 'PREMIUM'
        ? DRAFT_PREMIUM_MODEL // Sol — serious drafting
        : economyModel;

    const skipResearchGrounding =
      expressMode &&
      !hybridNoticeCaseLaw &&
      !dto.formNumber?.trim() &&
      !(dto.pinnedCaseLaws?.length) &&
      !wantsCaseLaw(dto.knowledgeSources);

    // Theory of the case before any authority search, so retrieval is aimed at
    // the grounds we intend to plead rather than at the fact pattern in general.
    const caseTheory = await this.caseTheory.build({
      facts: dto.caseDetails ?? '',
      documentKind: effectiveKind,
      countryCode: 'IN',
      jurisdiction: dto.jurisdiction,
      caseBrief,
      model: DRAFT_ENRICH_MODEL,
      filingGrade: this.isFilingGradeKind(effectiveKind) && !skipResearchGrounding,
    });
    const caseTheoryQueries = this.caseTheory.buildAuthorityQueries(caseTheory, {
      documentKind: effectiveKind,
      jurisdiction: dto.jurisdiction,
    });

    // Drafting intelligence map before grounding (non-express / case-law paths).
    let mapQueries: string[] = [];
    if (!skipResearchGrounding && dto.caseDetails?.trim() && !bundleSubsequent) {
      try {
        const draftingMap = await this.draftingIntelligenceMap.buildMap({
          caseDetails: dto.caseDetails,
          countryCode: 'IN',
          jurisdiction: dto.jurisdiction,
          kind: effectiveKind,
          practiceArea: dto.practiceArea ?? miProfile?.practiceArea,
        });
        mapQueries = [...new Set([...draftingMap.researchQueries, ...draftingMap.searchHints])].slice(
          0,
          12,
        );
      } catch (err) {
        this.logger.warn(
          `Drafting intelligence map skipped: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    const [statuteGrounding, statuteGroundingAuthorities, researchGrounding] = await Promise.all([
      this.grounding.buildGroundingBlock(
        effectiveKind,
        dto.caseDetails,
        routerResult.governingSections,
        dto.pinnedSections ?? [],
      ),
      this.grounding.buildGroundingAuthorities(effectiveKind, routerResult.governingSections),
      skipResearchGrounding
        ? Promise.resolve<DraftResearchGroundingResult>({
            authorities: [],
            verifiedAuthoritiesBlock: [
              'VERIFIED AUTHORITIES (cite ONLY from this list):',
              '(Pre-litigation notice — cite governing statute sections from the statute grounding block above. Do NOT invent AIR/SCC case citations unless explicitly provided in case details.)',
            ].join('\n'),
            retrievalConfidence: 'high' as const,
            usedDeepResearch: false,
          })
        : this.researchGrounding.buildGrounding({
            kind: effectiveKind,
            caseDetails: dto.caseDetails,
            countryCode: 'IN',
            jurisdiction: dto.jurisdiction,
            courtName: dto.courtName,
            tenantId: ctx.tenantId,
            tenantRole: ctx.tenantRole,
            userId: ctx.userId,
            matterId: dto.matterId,
            proceduralResult: routerResult,
            hybridExpressNotice: hybridNoticeCaseLaw,
            bundleFastPath: bundleSubsequent,
            // Gate expensive deep-research: only complex/PREMIUM drafts warrant it.
            skipDeepResearch: !this.draftComplexity.requiresDeepResearch(docComplexity),
            // Step budget — complex gets 6, standard 3, simple 0 (skipped above).
            maxDeepResearchSteps: this.draftComplexity.maxDeepResearchSteps(docComplexity),
            formNumber: dto.formNumber,
            formTitle: dto.formTitle,
            pinnedCaseLaws: dto.pinnedCaseLaws,
            knowledgeSources: dto.knowledgeSources,
            extraRetrievalQueries: [...new Set([...caseTheoryQueries, ...mapQueries])].slice(0, 14),
          }),
    ]);

    const preDraft = await this.preChecklist.evaluate({
      kind: effectiveKind,
      caseDetails: dto.caseDetails,
      courtName: dto.courtName,
      jurisdiction: dto.jurisdiction,
      countryCode: 'IN',
      proceduralResult: routerResult,
      authorityCount: researchGrounding.authorities.length,
    });

    const filingGrade = this.isFilingGradeKind(effectiveKind);

    const authoritiesOnPoint = authoritiesOnPointForKind(
      researchGrounding.authorities,
      effectiveKind,
      dto.caseDetails,
    );
    const skeletonMode =
      routerResult.kindOverridden ||
      researchGrounding.authorities.length < 1 ||
      !authoritiesOnPoint;

    const routerBlock = this.proceduralRouter.buildPromptBlock(routerResult);
    const gateBlock = this.proceduralGate.buildPromptBlock(gate);
    const referenceBlock = this.structuralReference.buildPromptBlock(effectiveKind);

    const caseLawBlock = caseLawPromptBlock(effectiveKind);
    const terminologyBlock = buildLegalTerminologyBlock(effectiveKind);
    const styleBlock = this.promptInjection
      ? await this.promptInjection.resolveStyleBlock(ctx.userId, dto.styleId).catch(() => null)
      : null;
    const intakeBlock = this.intakeExtraction.buildPromptBlock(structuredIntake);
    const fidelityBlock = this.factFidelity.buildPromptBlock(dto.caseDetails);
    const caseBriefBlock = this.caseBriefService.buildPromptBlock(caseBrief);
    const matterFacts = dto.caseDetails
      .split(/(?<=[.!?])\s+|\n+/)
      .map((f) => f.trim())
      .filter((f) => f.length > 12)
      .slice(0, 20)
      .map((description, index) => ({ factId: `fact_${index + 1}`, description }));
    const draftEvidencePack = this.evidencePackService.buildFromAuthorities({
      jurisdiction: dto.jurisdiction ?? 'IN',
      authorities: [
        ...researchGrounding.authorities,
        ...statuteGroundingAuthorities,
      ],
      matterFacts,
    });
    const planningConstraints = this.verificationOutcomes
      ? await this.verificationOutcomes.loadPlanningConstraints(
          ctx.tenantId,
          effectiveKind,
          5,
          dto.jurisdiction ?? 'IN',
        )
      : [];
    const groundsPlan = this.propositionPlan.build({
      kind: effectiveKind,
      caseDetails: dto.caseDetails,
      archetype: archetypeRoute,
      groundingAuthorities: researchGrounding.authorities,
      evidencePack: draftEvidencePack,
      countryCode: 'IN',
      planningConstraints,
    });
    const propositionPlanBlock = this.propositionPlan.buildPromptBlock(groundsPlan);
    const argumentGraph = this.argumentGraph.build({
      theory: caseTheory,
      sources: toVerifiedSources(researchGrounding.authorities),
      facts: caseBrief.defenceFacts,
    });
    const caseTheoryBlock = [
      this.caseTheory.buildPromptBlock(caseTheory),
      this.argumentGraph.buildPromptBlock(argumentGraph, toVerifiedSources(researchGrounding.authorities)),
    ]
      .filter(Boolean)
      .join('\n\n');
    const archetypeWarnBlock = archetypeRoute.warnings.length
      ? `ARCHETYPE WARNINGS:\n${archetypeRoute.warnings.map((w) => `- ${w}`).join('\n')}`
      : '';
    const baseSystemPrompt = `${draftingRulesForKind(effectiveKind)}\n\n${resolvedFormatPrompt}\n\n${referenceBlock}\n\n${statuteGrounding}\n\n${researchGrounding.verifiedAuthoritiesBlock}\n\n${caseTheoryBlock}\n\n${propositionPlanBlock}\n\n${caseBriefBlock}\n\n${intakeBlock}\n\n${fidelityBlock}\n\n${preDraft.promptBlock}\n\n${sectionRoute.promptBlocks.drafting}\n\n${routerBlock}${archetypeWarnBlock ? `\n\n${archetypeWarnBlock}` : ''}${gateBlock ? `\n\n${gateBlock}` : ''}${caseLawBlock ? `\n\n${caseLawBlock}` : ''}${terminologyBlock ? `\n\n${terminologyBlock}` : ''}${langInstruction}${styleBlock ? `\n\n${styleBlock}` : ''}`;

    const contextLines: string[] = [];
    const consumerMatter = hasConsumerMatterSignals(effectiveKind, dto.caseDetails);
    if (dto.clientName) {
      contextLines.push(
        consumerMatter || isResearchMemoKind(effectiveKind)
          ? `Complainant / Client: ${dto.clientName}`
          : `Client/Accused Name: ${dto.clientName}`,
      );
    }
    if (dto.courtName) contextLines.push(`Court / Forum: ${dto.courtName}`);
    if (dto.opposingParty) {
      contextLines.push(
        consumerMatter || isResearchMemoKind(effectiveKind)
          ? `Opposite Parties: ${dto.opposingParty}`
          : `Opposing Party / Complainant: ${dto.opposingParty}`,
      );
    }
    if (dto.parties) {
      const plaintiffs = (dto.parties.plaintiffs ?? [])
        .map((p) => `${p.role}: ${p.name}`)
        .join('; ');
      const defendants = (dto.parties.defendants ?? [])
        .map((p) => `${p.role}: ${p.name}`)
        .join('; ');
      if (consumerMatter || isResearchMemoKind(effectiveKind)) {
        if (plaintiffs) contextLines.push(`Complainant side: ${plaintiffs}`);
        if (defendants) contextLines.push(`Opposite Parties: ${defendants}`);
      } else {
        if (plaintiffs) contextLines.push(`Plaintiffs / Petitioners: ${plaintiffs}`);
        if (defendants) contextLines.push(`Defendants / Respondents: ${defendants}`);
      }
    }

    // Prefer user-confirmed CaseRecord when provided; else extract for prompt + accuracy.
    const caseRecordForDraft =
      dto.confirmedCaseRecord &&
      typeof dto.confirmedCaseRecord === 'object' &&
      Array.isArray((dto.confirmedCaseRecord as { parties?: unknown }).parties)
        ? (dto.confirmedCaseRecord as unknown as import('@/ai/drafting/contracts/case-record').CaseRecord)
        : this.caseRecordExtraction.extract({
            caseDetails: dto.caseDetails ?? '',
            documentKind: effectiveKind,
            jurisdiction: dto.jurisdiction,
            courtName: dto.courtName,
            clientName: dto.clientName,
            opposingParty: dto.opposingParty,
            parties: dto.parties,
            attachmentContext: dto.attachmentContext,
          });

    const caseRecordPromptBlock = this.buildCaseRecordPromptBlock(caseRecordForDraft);

    const attachmentBlock = dto.attachmentContext
      ? `\n\nATTACHED DOCUMENT CONTEXT (user-provided — use as additional factual reference):\n${dto.attachmentContext.slice(0, 6000)}`
      : '';

    const userContext = `${contextLines.length ? contextLines.join('\n') + '\n\n' : ''}${caseRecordPromptBlock ? caseRecordPromptBlock + '\n\n' : ''}Case Details / Facts:
${dto.caseDetails}${attachmentBlock}`;

    await this.creditLedger.assertSufficientBalance({
      userId: ctx.userId,
      tenantId: ctx.tenantId,
      taskType: AI_TASK_TYPES.INDIA_COURT_DRAFT,
    });

    const skeletonInstruction = skeletonMode
      ? `\nSKELETON MODE (mandatory): Procedural route or on-point verified authorities are incomplete. Cause title MUST use "${ routerResult.causeTitleVehicle }". Maintainability MUST include "[PROCEDURAL VEHICLE TO BE CONFIRMED — Criminal Revision under BNSS §438 vs Appeal]" where route is unverified. GROUNDS must be filled reasoned legal argument tied to the facts (not empty issue labels). Where a citation is needed but missing from VERIFIED AUTHORITIES, write the reasoned ground and mark the gap inline as [AUTHORITY GAP: proposition / issue needing authority] — never invent AIR/SCC citations and never leave grounds as labels-only. Do NOT cite Article 133, Article 226, or CPC Order XXXIX. Do NOT state maintainability or jurisdiction as confirmed fact. Do NOT include Counsel Certification, Notes on Completion, or Disclaimer sections.`
      : '';

    // Per-pass instructions separated from baseSystemPrompt so the expensive
    // base context (statute grounding + verified authorities + DU rules) can be
    // cached once and reused for both Pass 1 and Pass 2 via multi-block caching.
    const structureInstruction = (() => {
      if (isResearchMemoKind(effectiveKind)) {
        return `\n\nSTRUCTURE INSTRUCTION (RESEARCH / STRATEGY MEMO — mandatory): Produce a Legal Research or Case Strategy Memorandum only. Required sections: SHORT ANSWER / EXECUTIVE SUMMARY; ISSUES; MATERIAL FACTS (from CaseRecord — fill known dates/names/amounts; [BLANK] only if missing); APPLICABLE LAW & AUTHORITIES (supporting AND adverse); ANALYSIS; NEXT STEPS & LIMITATIONS. FORBIDDEN: CAUSE TITLE, MOST RESPECTFULLY SHOWETH, MEMO OF PARTIES as a pleading, PRAYER, VERIFICATION, Petitioner/Respondent captions. For consumer matters use Complainant / Opposite Party. Do NOT invent insurer denial or AIR/SCC citations not in VERIFIED AUTHORITIES.`;
      }
      if (/consumer_complaint|consumer_medical/i.test(effectiveKind)) {
        return `\n\nSTRUCTURE INSTRUCTION (CONSUMER COMPLAINT — mandatory): Produce a complete consumer complaint. Required sections: CAUSE TITLE; PARTIES (Complainant / Opposite Party — never Petitioner/Respondent); JURISDICTION; LIMITATION; STATEMENT OF FACTS (full chronology from CaseRecord — surgery, consent, hospital, amounts; never a stub or single name); GROUNDS (CPA 2019 provisions + deficiency; never "for specific risks is blank"); PRAYER; VERIFICATION. Fill known dates/names/amounts from CaseRecord. Do NOT invent insurer claim denial/repudiation unless CaseRecord expressly supports it. Do NOT invent AIR/SCC citations.`;
      }
      if (expressMode) {
        return `\n\nDRAFT INSTRUCTION: Produce the complete ${effectiveKind.replace(/^india_/, '').replace(/_/g, ' ')} in one pass. Include parties, chronology of facts, legal grounds citing applicable statute sections, demand/relief, and execution block. Use [BLANK: description] only for facts not in the case details. Do NOT invent AIR/SCC citations.`;
      }
      return `${filingGrade ? '' : skeletonInstruction}\n\nSTRUCTURE INSTRUCTION: Produce the complete court document. Include a filled cause title (use procedural vehicle "${ routerResult.causeTitleVehicle }" from PRE-DRAFT CHECKLIST), parties, maintainability and limitation sections where applicable, numbered facts, reasoned GROUNDS (full argument text — use [AUTHORITY GAP: …] where citation needed; never issue labels ONLY), prayer, verification. Use [BLANK: description] for missing facts. Do NOT invent AIR/SCC citations. No Defined Terms, Recitals, or audit footers.`;
    })();

    // Multi-block system: cache the large base context block (baseSystemPrompt),
    // leave the short per-pass instruction uncached. This lets Pass 2 re-use the
    // same 5-min ephemeral cache entry written by Pass 1 for the base block,
    // cutting Anthropic input costs by 50–80% on the second call.
    const pass1SystemBlocks: LlmSystemBlock[] = [
      { text: baseSystemPrompt, cache: true },
      { text: structureInstruction },
    ];

    // Use a larger token budget for complex/PREMIUM drafts to reduce continuation passes.
    // Continuation passes cost 15 credits each; allocating more tokens upfront is cheaper.
    const pass1MaxTokens =
      expressMode ? 4000
      : docComplexity === 'complex' || modelMode === 'PREMIUM' ? 7000
      : docComplexity === 'standard' ? 5500
      : 3500; // simple

    const pass1UserInstruction = `${userContext}\n\nDraft the complete document for the above matter. Write every required section in full from the case facts (cause title, parties, jurisdiction where applicable, facts, grounds, prayer, verification). Do not emit empty headings or a structure-only skeleton.`;

    const pass1Raw = await this.llm.complete({
      modelName: pass1Model,
      messages: [
        {
          role: 'user',
          content: pass1UserInstruction,
        },
      ],
      systemBlocks: pass1SystemBlocks,
      maxTokens: pass1MaxTokens,
      temperature: 0.2,
    });

    const pass1Content = await this.continueIfTruncated(
      pass1Raw,
      pass1SystemBlocks,
      pass1Model,
      ctx.userId,
      ctx.tenantId,
      maxContinuations,
    );
    const pass1 = { ...pass1Raw, content: pass1Content };

    // Pass 2 (enrichment) only needs the verified authorities block and enrichment
    // instructions — not the full structural rules, format prompts, or router block.
    // This trims the input token count by ~60% vs repeating the full baseSystemPrompt,
    // and still shares the cached base block with Pass 1 for the authorities portion.
    //
    // The base block (cache: true) re-uses the Pass 1 cache entry if Pass 2 runs
    // within 5 minutes (always true for same-request draft generation).
    const enrichBaseBlock = `${researchGrounding.verifiedAuthoritiesBlock}`;

    const enrichInstructionBlock = `ENRICHMENT INSTRUCTION: You are given an existing draft structure. Your task:
1. Replace every "[AUTHORITY TO BE ADDED]" placeholder with the most relevant authority from the VERIFIED AUTHORITIES block above. Match by ground topic — quantum/disproportionality → Rajnesh/Kalyan Dey; income affidavit → Sunita Kachwaha/Bhuwan Mohan Singh; wife's earning capacity → Shailja; date from which payable → Vinny Parmar/Rajnesh; revisional jurisdiction scope → use the revisional jurisdiction authority.
2. If the VERIFIED AUTHORITIES block contains no matching authority for a specific ground, leave the placeholder as "[AUTHORITY TO BE ADDED — counsel to supply verified citation]".
3. Do NOT add new facts, parties, or amounts beyond what is in the draft.
4. Do NOT invent citations outside the VERIFIED AUTHORITIES block — never fabricate AIR, SCC, or Cr.LJ citations.
5. Preserve all [BLANK: …] placeholders exactly.
6. Return the complete revised document only — no internal labels, audit summaries, or PASS markers.`;

    // Keep the full enrichSystem string for the regen loop (uses expressMode fallback)
    const enrichSystem = `${enrichBaseBlock}\n\n${enrichInstructionBlock}`;

    let pass2 = pass1;
    const skipPass2 =
      expressMode ||
      (!filingGrade && skeletonMode) ||
      (bundleSubsequent && authoritiesOnPoint && researchGrounding.authorities.length >= 3);
    if (!skipPass2) {
      const pass2SystemBlocks: LlmSystemBlock[] = [
        { text: enrichBaseBlock, cache: true },
        { text: `\n\n${enrichInstructionBlock}` },
      ];
      const pass2Raw = await this.llm.complete({
        modelName: DRAFT_ENRICH_MODEL,
        messages: [
          {
            role: 'user',
            content: `${userContext}\n\nExisting draft to enrich with verified authorities:\n\n${pass1.content}`,
          },
        ],
        systemBlocks: pass2SystemBlocks,
        maxTokens: 6000,
        temperature: 0.2,
      });
      const pass2Content = await this.continueIfTruncated(
        pass2Raw,
        pass2SystemBlocks,
        DRAFT_ENRICH_MODEL,
        ctx.userId,
        ctx.tenantId,
        maxContinuations,
      );
      pass2 = { ...pass2Raw, content: pass2Content };
    }

    let draftText = pass2.content.trim();
    let verified = await this.verification.verify({
      draft: draftText,
      kind: effectiveKind,
      caseDetails: dto.caseDetails,
      jurisdiction: dto.jurisdiction,
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      proceduralWarnings: [
        ...routerResult.proceduralWarnings,
        ...archetypeRoute.warnings,
      ],
      completenessGaps: [
        ...routerResult.completenessGaps,
        ...archetypeRoute.missingFacts,
      ],
      recommendedKind: effectiveKind,
      causeTitleVehicle: routerResult.causeTitleVehicle,
      authoritiesOnPoint,
      groundingAuthorities: [...researchGrounding.authorities, ...statuteGroundingAuthorities],
      offenceDate,
      filingDate,
    });

    let regenAttempts = 0;
    const maxRegen = bundleSubsequent ? 1 : filingGrade ? 2 : 1;
    while (regenAttempts < maxRegen && this.shouldRegenerate(verified.audit, filingGrade)) {
      regenAttempts += 1;
      this.logger.log(`Regenerating draft (attempt ${regenAttempts}) due to verification failures`);
      const unified = await this.unifiedVerification.runChecks({
        query: `${dto.caseDetails} ${effectiveKind}`,
        outputMarkdown: verified.draft,
        authorities: researchGrounding.authorities,
        countryCode: 'IN',
      });
      const correctionPrompt = this.unifiedVerification.buildCorrectionPrompt(
        {
          query: `${dto.caseDetails} ${effectiveKind}`,
          outputMarkdown: verified.draft,
          authorities: researchGrounding.authorities,
          countryCode: 'IN',
        },
        unified,
      );
      const regenSystemBlocks: LlmSystemBlock[] = expressMode
        ? [{ text: baseSystemPrompt, cache: true }, { text: structureInstruction }]
        : [{ text: enrichBaseBlock, cache: true }, { text: `\n\n${enrichInstructionBlock}` }];
      const regen = await this.llm.complete({
        modelName: DRAFT_ENRICH_MODEL,
        messages: [
          {
            role: 'user',
            content: `${userContext}\n\n${correctionPrompt}\n\nPrevious draft:\n${verified.draft}`,
          },
        ],
        systemBlocks: regenSystemBlocks,
        maxTokens: 6000,
        temperature: 0.15,
      });
      draftText = regen.content.trim();
      verified = await this.verification.verify({
        draft: draftText,
        kind: effectiveKind,
        caseDetails: dto.caseDetails,
        jurisdiction: dto.jurisdiction,
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        proceduralWarnings: [
          ...routerResult.proceduralWarnings,
          ...archetypeRoute.warnings,
        ],
        completenessGaps: [
          ...routerResult.completenessGaps,
          ...archetypeRoute.missingFacts,
        ],
        recommendedKind: effectiveKind,
        causeTitleVehicle: routerResult.causeTitleVehicle,
        authoritiesOnPoint,
        groundingAuthorities: [...researchGrounding.authorities, ...statuteGroundingAuthorities],
        offenceDate,
        filingDate,
      });
    }

    const totalInputTokens = pass1.inputTokens + pass2.inputTokens;
    const totalOutputTokens = pass1.outputTokens + pass2.outputTokens;

    // Persist verification/repair outcome for self-learning (non-blocking)
    if (this.verificationOutcomes) {
      void this.verificationOutcomes.record({
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        documentKind: effectiveKind,
        jurisdiction: dto.jurisdiction,
        audit: verified.audit,
        repairAttempted: regenAttempts > 0,
        repairSucceeded:
          regenAttempts > 0 && verified.audit.verificationStatus === 'verified',
        regenAttempts,
        modelUsed: pass2.modelName,
        countryCode: 'IN',
      });
    }

    // Auto-capture draft correction signals from statute normalizer corrections
    if (this.draftCorrections && verified.audit.corrections.length > 0) {
      for (const corr of verified.audit.corrections.slice(0, 5)) {
        void this.draftCorrections.storePending({
          tenantId: ctx.tenantId,
          documentKind: effectiveKind,
          jurisdiction: dto.jurisdiction,
          countryCode: 'IN',
          wrongCitation: corr.from,
          correctCitation: corr.to,
          confidence: 0.7,
        });
      }
    }

    const creditBand = this.draftComplexity.toCreditBand(docComplexity);
    const recorded = await this.usageRecorder.recordTokenUsage({
      userId: ctx.userId,
      tenantId: ctx.tenantId,
      taskType: AI_TASK_TYPES.INDIA_COURT_DRAFT,
      mode: modelMode,
      modelName: pass2.modelName,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      countryCode: 'IN',
      // Use the complexity-banded credit floor so simple forms cost less
      flatCredits: getDraftCreditFloor(creditBand),
      metadata: {
        kind: effectiveKind,
        userKind: dto.kind,
        docComplexity,
        creditBand,
        verificationCorrections: verified.audit.corrections.length,
        similarCasesUsed: verified.audit.similarCases.length,
        strippedCitations: verified.audit.strippedCitations.length,
      },
    });

    const label =
      dto.label ??
      (dto.kind === 'india_form_catalog'
        ? (dto.formTitle ?? dto.formNumber)
        : undefined) ??
      effectiveKind.replace(/^india_/, '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

    let draftId: string | undefined;
    try {
      const saved = await this.draftHistory.save({
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        source: dto.kind === 'india_form_catalog' ? 'form_catalog' : 'india',
        matterId: dto.matterId,
        tenantRole: ctx.tenantRole,
        kind: effectiveKind,
        label,
        subtitle: dto.authority ?? undefined,
        category: dto.category,
        countryCode: 'IN',
        jurisdiction: dto.jurisdiction,
        language: dto.language ?? 'en',
        caseDetails: dto.caseDetails,
        clientName: dto.clientName,
        courtName: dto.courtName,
        opposingParty: dto.opposingParty,
        draftText: verified.draft,
        verificationAudit: verified.audit,
        creditsUsed: recorded.chargedCredits,
      });
      draftId = saved.id;
    } catch (err) {
      this.logger.warn(`Failed to persist draft history: ${err instanceof Error ? err.message : String(err)}`);
    }

    const structureViolations = this.structureAudit.audit(verified.draft, effectiveKind);

    const coverage = this.factCoverage.evaluate({
      draft: verified.draft,
      brief: caseBrief,
      kind: effectiveKind,
      filingGrade,
    });
    const caseAuthorityCount = researchGrounding.authorities.filter(
      (a) =>
        a.sourceTier === 'case_law' ||
        (a.authorityType ?? '').toUpperCase().includes('CASE'),
    ).length;
    const gateResult = this.accuracyGate.evaluate({
      audit: verified.audit,
      preDraft,
      filingGrade,
      authorityCount: researchGrounding.authorities.length,
      recommendedKind: effectiveKind,
      causeTitleVehicle: routerResult.causeTitleVehicle,
      draftText: verified.draft,
      authoritiesOnPoint,
      factCoverage: coverage,
      verifiedCaseAuthorityCount: caseAuthorityCount,
      minVerifiedCaseAuthorities: playbook.minVerifiedCaseAuthorities,
      pleadingReviewCompleted: !filingGrade,
      unresolvedHighIssues: (verified.audit.findings ?? []).filter(
        (f) => f.severity === 'BLOCKER' || f.severity === 'HIGH',
      ).length,
    });

    // Universal accuracy: review → repair → re-audit (not evaluate-only)
    const accuracyMode =
      dto.accuracyMode === 'fast' || dto.accuracyMode === 'strict'
        ? dto.accuracyMode
        : filingGrade ||
            dto.confirmedCaseRecord ||
            hasConsumerMatterSignals(effectiveKind, dto.caseDetails)
          ? 'balanced'
          : 'fast';
    const autoRepair = await this.accuracyOrchestrator.reviewAndRepair(
      {
        caseRecord: caseRecordForDraft,
        draftText: verified.draft,
        documentKind: effectiveKind,
        caseDetails: dto.caseDetails,
        requiredSections: isResearchMemoKind(effectiveKind)
          ? ['SHORT ANSWER', 'ISSUES', 'FACTS', 'ANALYSIS', 'AUTHORITIES', 'NEXT STEPS']
          : playbook.requiredSections,
        consumerMatterSignals: hasConsumerMatterSignals(effectiveKind, dto.caseDetails),
        playbookSummary: `${effectiveKind}@${playbook.kind}`,
      },
      { mode: accuracyMode },
    );
    verified.draft = autoRepair.draftText;

    // Senior-partner read of the assembled filing. Same contract as the unified
    // engine: reconcile only, never introduce a citation or date that was not there.
    const coherence = await this.coherenceReview.review({
      draft: verified.draft,
      documentKind: effectiveKind,
      countryCode: 'IN',
      jurisdiction: dto.jurisdiction,
      caseTheoryPromptBlock: caseTheoryBlock,
      model: DRAFT_ENRICH_MODEL,
      allowRevision: filingGrade,
    });
    if (coherence.revisedDraft) verified.draft = coherence.revisedDraft;
    const coherenceBlockers = coherence.issues.filter(
      (issue) => issue.severity === 'BLOCKER' || issue.severity === 'HIGH',
    );
    if (coherenceBlockers.length > 0) {
      verified.audit = {
        ...verified.audit,
        citationWarnings: [
          ...verified.audit.citationWarnings,
          ...coherenceBlockers.map((issue) => `Coherence [${issue.category}]: ${issue.explanation}`),
        ],
      };
    }

    const accuracyBlockers = autoRepair.finalFindings.filter((f) => f.severity === 'blocker');
    const finalResolutionStatus = autoRepair.finalStatus;
    if (
      accuracyBlockers.length > 0 ||
      finalResolutionStatus === 'needs_user_confirmation' ||
      finalResolutionStatus === 'needs_advocate_review' ||
      finalResolutionStatus === 'blocked'
    ) {
      gateResult.canExport = false;
      gateResult.canCertify = false;
      gateResult.lawyerReady = false;
      if (gateResult.certificationLabel === 'lawyer_ready') {
        gateResult.certificationLabel = 'needs_review';
      }
      verified.audit = {
        ...verified.audit,
        citationWarnings: [
          ...verified.audit.citationWarnings,
          ...accuracyBlockers.map((b) => `Accuracy: [${b.code}] ${b.message}`),
        ],
      };
    }
    // Allow export when repair cleaned all blockers
    if (
      (finalResolutionStatus === 'clean' || finalResolutionStatus === 'repaired') &&
      accuracyBlockers.length === 0
    ) {
      // leave gateResult as produced by accuracyGate; do not force-block
    }
    verified.audit = {
      ...verified.audit,
      canCertify: gateResult.canCertify && structureViolations.length === 0,
      certificationLabel: structureViolations.length > 0 ? 'needs_review' : gateResult.certificationLabel,
      unresolvedFacts: gateResult.unresolvedFacts,
      lawyerReady: gateResult.lawyerReady && structureViolations.length === 0,
      factCoverageRate: coverage.coverageRate,
      missingDefenceFacts: coverage.missing,
      filingReadiness: gateResult.filingReadiness,
      citationWarnings: [
        ...verified.audit.citationWarnings,
        ...structureViolations.map((v) => `Structure: ${v}`),
      ],
    };

    // Strip the counsel's pre-filing checklist from the pleading body so it
    // is never rendered inside the draft document. Return it as a separate field.
    const checklistMatch = verified.draft.match(
      /\n(COUNSEL'?S?\s+PRE[-\s]FILING\s+CHECKLIST[\s\S]*)/i,
    );
    const cleanDraft = checklistMatch
      ? verified.draft.slice(0, verified.draft.length - checklistMatch[1].length).trimEnd()
      : verified.draft;
    const counselChecklist = checklistMatch ? checklistMatch[1].trim() : undefined;

    if (draftId) {
      try {
        await this.draftHistory.update(draftId, ctx.tenantId, ctx.userId, {
          draftText: cleanDraft,
          verificationAudit: verified.audit,
        });
      } catch (err) {
        this.logger.warn(
          `Failed to persist final filing-readiness report: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    if (miProfile) {
      const profileHash = this.selectionTracking.profileHash(miProfile);
      void this.selectionTracking.record({
        eventType: 'document_generated',
        matterProfileHash: profileHash,
        practiceArea: miProfile.practiceArea,
        subPracticeArea: miProfile.subPracticeArea,
        nature: miProfile.nature,
        documentKind: effectiveKind,
        tenantId: ctx.tenantId,
        userId: ctx.userId,
      }).catch(() => undefined);
    }

    // Build citation appendix for v1 drafts using the shared builder.
    const v1CitationAppendix = requiresCaseLawCitations(effectiveKind)
      ? this.citationAppendixBuilder.buildFromText(cleanDraft, researchGrounding.authorities)
      : [];
    const v1SourceRegistry = registryFromRetrievedAuthorities({
      jobId: draftId ?? `draft_${Date.now()}`,
      jurisdiction: dto.jurisdiction ?? 'IN',
      authorities: researchGrounding.authorities,
    });
    const authorityEvidenceBundle = buildAuthorityEvidenceBundle({
      consumer: 'draft_generation',
      jurisdiction: dto.jurisdiction ?? 'IN',
      documentKind: effectiveKind,
      sourceRegistry: v1SourceRegistry,
      appendixOnly: effectiveKind === 'india_suit_recovery_cpc_37',
    });
    if (draftId) {
      try {
        await this.draftHistory.update(draftId, ctx.tenantId, ctx.userId, {
          sourceRegistry: v1SourceRegistry,
          citationAppendix: v1CitationAppendix,
          filingReadiness: {
            ...gateResult.filingReadiness,
            authorityEvidenceBundle,
            retrievalQueries: researchGrounding.retrievalQueries,
            requiredVerifiedCases: researchGrounding.requiredVerifiedCases,
            authorityShortfall: researchGrounding.authorityShortfall,
          },
        });
      } catch (err) {
        this.logger.warn(
          `Failed to persist authority/readiness artifacts: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    const v1Result: GenerateIndiaDraftResult = {
      draft: cleanDraft,
      counselChecklist,
      creditsUsed: recorded.chargedCredits,
      modelUsed: DRAFT_PREMIUM_MODEL,
      verification: verified.audit,
      draftId,
      authorityEvidenceBundle,
      proceduralDetermination: {
        recommendedKind: routerResult.recommendedKind,
        userSelectedKind: routerResult.userSelectedKind,
        kindOverridden: routerResult.kindOverridden,
        maintainabilityNotes: routerResult.maintainabilityNotes,
        governingSections: routerResult.governingSections,
      },
      researchPhase: {
        retrievalConfidence: researchGrounding.retrievalConfidence,
        usedDeepResearch: researchGrounding.usedDeepResearch,
        authorityCount: researchGrounding.authorities.length,
      },
      preDraftChecklist: preDraft.checklist,
      resolvedItems: preDraft.resolvedItems,
      unresolvedItems: preDraft.unresolvedItems,
      accuracyGate: gateResult,
      citationAppendix: v1CitationAppendix.length > 0 ? v1CitationAppendix : undefined,
      engineVersion: 'v1',
      finalResolutionStatus,
      repairAttemptCount: autoRepair.attempts,
      resolvedFindingCodes: autoRepair.resolvedFindingCodes,
      unresolvedFindingCodes: autoRepair.unresolvedFindingCodes,
      confirmationQuestions: autoRepair.confirmationQuestions,
      accuracyFindings: autoRepair.finalFindings.map((f) => ({
        code: f.code,
        severity: f.severity,
        message: f.message,
        repairHint: f.repairHint,
      })),
    };

    // ── Shadow mode: sampled v2 background compare (max 2% of traffic by default) ─
    if (shouldRunShadowEvaluation(ctx.userId + effectiveKind)) {
      this.draftEngineV2
        .generate(
          {
            kind: dto.kind,
            caseDetails: dto.caseDetails,
            clientName: dto.clientName,
            courtName: dto.courtName,
            opposingParty: dto.opposingParty,
            jurisdiction: dto.jurisdiction,
            language: dto.language,
            formNumber: dto.formNumber,
            formTitle: dto.formTitle,
            authority: dto.authority,
            practiceArea: dto.practiceArea,
            category: dto.category,
            attachmentContext: dto.attachmentContext,
            label: dto.label,
            bundleMode: dto.bundleMode,
            bundleIndex: dto.bundleIndex,
          },
          ctx,
        )
        .then((v2Result) => {
          this.shadowService.compare(
            effectiveKind,
            dto.jurisdiction ?? 'IN',
            v1Result,
            v2Result,
          );
        })
        .catch((err) => {
          this.logger.warn(`Shadow v2 generation failed: ${err instanceof Error ? err.message : String(err)}`);
        });
    }

    return v1Result;
  }

  private buildCaseRecordPromptBlock(
    caseRecord: import('@/ai/drafting/contracts/case-record').CaseRecord,
  ): string {
    return buildCaseRecordPromptBlock(caseRecord);
  }

  private isFilingGradeKind(kind: string): boolean {
    return this.playbooks.isFilingGrade(kind);
  }

  private shouldRegenerate(audit: DraftVerificationAudit, filingGrade: boolean): boolean {
    if (audit.citationWarnings.some((w) => /Legal safety/i.test(w))) return true;
    if (audit.strippedCitations.length > 0) return true;
    if (audit.citationWarnings.some((w) => /unverifiable|Acronym error|BNSS section error/i.test(w))) {
      return true;
    }
    if (filingGrade && audit.requiresLawyerReview) return true;
    if (audit.strippedCitations.length > 2) return true;
    if (
      audit.citationWarnings.some((w) => /unverifiable/i.test(w)) &&
      audit.strippedCitations.length > 0
    ) {
      return true;
    }
    return false;
  }

  private buildRegenFeedback(audit: DraftVerificationAudit): string {
    const parts: string[] = [];
    if (audit.strippedCitations.length > 0) {
      parts.push(`Stripped unverified citations: ${audit.strippedCitations.slice(0, 5).join('; ')}`);
    }
    for (const w of audit.citationWarnings.slice(0, 5)) {
      parts.push(w);
    }
    for (const c of audit.corrections.slice(0, 3)) {
      parts.push(`Statute correction: ${c.from} → ${c.to}`);
    }
    return parts.join('\n');
  }

  private computeVerificationFixCharge(params: {
    modelName: string;
    inputTokens: number;
    outputTokens: number;
  }): { providerCostUsd: number; credits: number } {
    const costs = getModelCostSync(params.modelName);
    const providerCostUsd = estimateTokenCostUsd(
      costs.inputPer1M,
      costs.outputPer1M,
      params.inputTokens,
      params.outputTokens,
    );
    const credits = computeCreditsFromProviderCost(
      providerCostUsd,
      0.01,
      VERIFICATION_FIX_NET_MARGIN_PERCENT,
      VERIFICATION_FIX_MIN_CREDITS,
    );
    return { providerCostUsd, credits };
  }

  private async recordVerificationFixUsage(
    ctx: DraftAuthContext,
    params: {
      documentKind: string;
      instruction: string;
      modelName: string;
      inputTokens: number;
      outputTokens: number;
    },
  ): Promise<number> {
    const charge = this.computeVerificationFixCharge(params);
    await this.creditLedger.assertAndDebit({
      userId: ctx.userId,
      tenantId: ctx.tenantId,
      taskType: AI_TASK_TYPES.DRAFT_VERIFICATION_FIX,
      credits: charge.credits,
      metadata: {
        documentKind: params.documentKind,
        instruction: params.instruction,
        netMarginPercent: VERIFICATION_FIX_NET_MARGIN_PERCENT,
      },
    });
    await this.usageRecorder.recordAfterFlatDebit({
      userId: ctx.userId,
      tenantId: ctx.tenantId,
      taskType: AI_TASK_TYPES.DRAFT_VERIFICATION_FIX,
      mode: 'AUTO',
      modelName: params.modelName,
      credits: charge.credits,
      costUsd: charge.providerCostUsd,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      countryCode: 'IN',
      metadata: {
        documentKind: params.documentKind,
        instruction: params.instruction,
        netMarginPercent: VERIFICATION_FIX_NET_MARGIN_PERCENT,
      },
    });
    return charge.credits;
  }

  private mergeGoverningSections(
    a: Array<{ actId: string; section: string; label: string; predecessor?: { actId: string; section: string } }>,
    b: Array<{ actId: string; section: string; label: string; predecessor?: { actId: string; section: string } }>,
  ) {
    const seen = new Set<string>();
    const out: typeof a = [];
    for (const s of [...a, ...b]) {
      const key = `${s.actId}:${s.section}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(s);
    }
    return out;
  }

  private buildAccuracyGate(
    draft: string,
    audit: DraftVerificationAudit,
    documentKind: string,
    preDraft?: {
      checklist: Record<string, boolean>;
      resolvedItems: string[];
      unresolvedItems: string[];
      promptBlock: string;
    },
  ): NonNullable<GenerateIndiaDraftResult['accuracyGate']> {
    return this.accuracyGate.evaluate({
      audit,
      preDraft: preDraft ?? {
        checklist: {},
        resolvedItems: [],
        unresolvedItems: audit.unresolvedFacts ?? audit.completenessGaps ?? [],
        promptBlock: '',
      },
      filingGrade: this.isFilingGradeKind(documentKind),
      authorityCount: audit.similarCases.length,
      recommendedKind: documentKind,
      draftText: draft,
      authoritiesOnPoint: true,
    });
  }

  /**
   * Apply user answers to ambiguous repair findings, bump CaseRecord, re-run reviewAndRepair.
   */
  async applyRepairConfirmations(
    dto: {
      documentKind: string;
      draft: string;
      caseRecord: import('@/ai/drafting/contracts/case-record').CaseRecord;
      answers: Array<{ findingCode: string; field: string; value: unknown }>;
      caseDetails?: string;
      accuracyMode?: 'fast' | 'balanced' | 'strict';
    },
    _ctx: DraftAuthContext,
  ): Promise<{
    draft: string;
    caseRecord: import('@/ai/drafting/contracts/case-record').CaseRecord;
    finalResolutionStatus: NonNullable<GenerateIndiaDraftResult['finalResolutionStatus']>;
    confirmationQuestions: NonNullable<GenerateIndiaDraftResult['confirmationQuestions']>;
    unresolvedFindingCodes: string[];
    resolvedFindingCodes: string[];
    accuracyGate: NonNullable<GenerateIndiaDraftResult['accuracyGate']>;
    accuracyFindings: NonNullable<GenerateIndiaDraftResult['accuracyFindings']>;
  }> {
    const playbook = this.playbooks.resolve(dto.documentKind);
    const filingGrade = this.isFilingGradeKind(dto.documentKind);
    const mode =
      dto.accuracyMode ??
      (filingGrade || hasConsumerMatterSignals(dto.documentKind, dto.caseDetails)
        ? 'balanced'
        : 'fast');

    const repaired = await this.accuracyOrchestrator.reviewAndRepair(
      {
        draftText: dto.draft,
        caseRecord: dto.caseRecord,
        documentKind: dto.documentKind,
        caseDetails: dto.caseDetails,
        requiredSections: isResearchMemoKind(dto.documentKind)
          ? ['ISSUES', 'FACTS', 'ANALYSIS', 'AUTHORITIES']
          : playbook.requiredSections,
        consumerMatterSignals: hasConsumerMatterSignals(dto.documentKind, dto.caseDetails),
        playbookSummary: `${dto.documentKind}@${playbook.kind}`,
      },
      {
        mode,
        confirmationAnswers: dto.answers,
      },
    );

    const blockers = repaired.finalFindings.filter((f) => f.severity === 'blocker');
    const canExport =
      blockers.length === 0 &&
      (repaired.finalStatus === 'clean' || repaired.finalStatus === 'repaired');

    return {
      draft: repaired.draftText,
      caseRecord: repaired.caseRecord,
      finalResolutionStatus: repaired.finalStatus,
      confirmationQuestions: repaired.confirmationQuestions,
      unresolvedFindingCodes: repaired.unresolvedFindingCodes,
      resolvedFindingCodes: repaired.resolvedFindingCodes,
      accuracyGate: {
        canCertify: canExport,
        canExport,
        certificationLabel: canExport ? 'verified_for_filing' : 'needs_review',
        lawyerReady: false,
      },
      accuracyFindings: repaired.finalFindings.map((f) => ({
        code: f.code,
        severity: f.severity,
        message: f.message,
        repairHint: f.repairHint,
      })),
    };
  }

  async reverify(
    dto: ReverifyIndiaDraftDto,
    ctx: DraftAuthContext,
  ): Promise<ReverifyIndiaDraftResult> {
    const caseDetails = dto.caseDetails ?? dto.draft;
    const gate = this.proceduralGate.check({
      kind: dto.documentKind,
      caseDetails,
      countryCode: 'IN',
    });
    const routerResult = this.proceduralRouter.route({
      kind: dto.documentKind,
      caseDetails,
      countryCode: 'IN',
      respectUserSelection: true,
    });
    const archetypeRoute = this.archetypeRouter.route({
      jurisdiction: 'IN',
      caseDetails,
      documentKind: dto.documentKind,
      offenceDate: dto.offenceDate,
      filingDate: dto.filingDate,
    });
    const preDraft = await this.preChecklist.evaluate({
      kind: dto.documentKind,
      caseDetails,
      jurisdiction: dto.jurisdiction,
      countryCode: 'IN',
      proceduralResult: {
        ...routerResult,
        governingSections: this.mergeGoverningSections(
          routerResult.governingSections,
          archetypeRoute.governingSections,
        ),
      },
      authorityCount: 0,
    });
    const verified = await this.verification.verify({
      draft: dto.draft,
      kind: dto.documentKind,
      caseDetails,
      jurisdiction: dto.jurisdiction,
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      proceduralWarnings: [
        ...gate.proceduralWarnings,
        ...archetypeRoute.warnings,
      ],
      completenessGaps: [
        ...gate.completenessGaps,
        ...preDraft.unresolvedItems,
        ...archetypeRoute.missingFacts,
      ],
      recommendedKind: dto.documentKind,
      offenceDate: dto.offenceDate,
      filingDate: dto.filingDate,
    });
    const accuracyGate = this.buildAccuracyGate(
      verified.draft,
      verified.audit,
      dto.documentKind,
      preDraft,
    );
    let citationAppendix: import('@/ai/drafting-v2/drafting-v2.types').CitationAppendixEntry[] | undefined;
    if (this.draftAuthorityVerification?.isEnabled()) {
      try {
        let sourceRegistry = dto.sourceRegistry;
        if (!sourceRegistry?.sources?.length) {
          const grounding = await this.researchGrounding.buildGrounding({
            kind: dto.documentKind,
            caseDetails,
            countryCode: 'IN',
            jurisdiction: dto.jurisdiction,
            tenantId: ctx.tenantId,
            tenantRole: ctx.tenantRole,
            userId: ctx.userId,
            matterId: dto.matterId,
            proceduralResult: routerResult,
            skipDeepResearch: true,
            maxDeepResearchSteps: 0,
            pinnedCaseLaws: dto.pinnedCaseLaws,
          });
          sourceRegistry = registryFromRetrievedAuthorities({
            jobId: `reverify_${Date.now()}`,
            jurisdiction: dto.jurisdiction ?? 'IN',
            authorities: grounding.authorities,
          });
        }
        const authResult = await this.draftAuthorityVerification.verify({
          draftText: verified.draft,
          documentKind: dto.documentKind,
          jurisdiction: dto.jurisdiction ?? 'IN',
          rawFacts: caseDetails,
          sourceRegistry,
          pinnedCaseLaws: dto.pinnedCaseLaws,
        });
        citationAppendix = authResult.citationAppendix;
        const authFindings = this.draftAuthorityVerification.toAccuracyFindings(authResult);
        if (authFindings.length > 0 && !authResult.gate.canExport) {
          accuracyGate.canCertify = false;
          accuracyGate.exportWatermark = 'AUTHORITY VERIFICATION FAILED — NOT FOR FILING';
        }
      } catch (err) {
        this.logger.warn(
          `Reverify authority verification failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    verified.audit = {
      ...verified.audit,
      canCertify: accuracyGate.canCertify,
      certificationLabel: accuracyGate.certificationLabel,
      unresolvedFacts: accuracyGate.unresolvedFacts,
    };
    return {
      draft: verified.draft,
      verification: verified.audit,
      accuracyGate,
      creditsUsed: 0,
      citationAppendix,
    };
  }

  async fixVerification(
    dto: FixVerificationDto,
    ctx: DraftAuthContext,
  ): Promise<ReverifyIndiaDraftResult> {
    let draft = dto.draft;
    let creditsUsed = 0;

    if (dto.instruction === 'add_citations' || dto.instruction === 'qualify_claim') {
      const selection = dto.selectedText?.trim() || dto.draft.slice(0, 4000);
      const added = await this.verification.addVerifiedCitations({
        selectedText: selection,
        kind: dto.documentKind,
        caseDetails: dto.caseDetails ?? dto.draft,
        jurisdiction: dto.jurisdiction,
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        instruction: dto.instruction === 'add_citations' ? 'add_citations' : 'strengthen',
      });
      draft = dto.draft.includes(selection)
        ? dto.draft.replace(selection, added.revisedText)
        : `${dto.draft}\n\n${added.revisedText}`;
      creditsUsed = await this.recordVerificationFixUsage(ctx, {
        documentKind: dto.documentKind,
        instruction: dto.instruction,
        modelName: added.modelName ?? DEFAULT_AUTO_MODEL,
        inputTokens: added.inputTokens ?? 0,
        outputTokens: added.outputTokens ?? 0,
      });
    } else if (dto.instruction === 'remove_claim') {
      const selection = dto.selectedText?.trim();
      if (selection && draft.includes(selection)) {
        draft = draft.replace(selection, '').replace(/\n{3,}/g, '\n\n').trim();
      } else if (selection) {
        // Soft-remove: strike invented claim language by blanking the selection block
        draft = `${draft}\n\n[REMOVED CLAIM — counsel to confirm deletion of: ${selection.slice(0, 200)}]`;
      }
      creditsUsed = await this.recordVerificationFixUsage(ctx, {
        documentKind: dto.documentKind,
        instruction: dto.instruction,
        modelName: DEFAULT_AUTO_MODEL,
        inputTokens: Math.ceil((dto.caseDetails?.length ?? dto.draft.length) / 4),
        outputTokens: Math.ceil(draft.length / 4),
      });
    } else if (dto.instruction === 'retrieve_authority' || dto.instruction === 'check_law') {
      const selection = dto.selectedText?.trim() || dto.draft.slice(0, 2000);
      const added = await this.verification.addVerifiedCitations({
        selectedText: selection,
        kind: dto.documentKind,
        caseDetails: dto.caseDetails ?? dto.draft,
        jurisdiction: dto.jurisdiction,
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        instruction: 'add_citations',
      });
      draft = dto.draft.includes(selection)
        ? dto.draft.replace(selection, added.revisedText)
        : `${dto.draft}\n\n${added.revisedText}`;
      creditsUsed = await this.recordVerificationFixUsage(ctx, {
        documentKind: dto.documentKind,
        instruction: dto.instruction,
        modelName: added.modelName ?? DEFAULT_AUTO_MODEL,
        inputTokens: added.inputTokens ?? 0,
        outputTokens: added.outputTokens ?? 0,
      });
    }

    const reverified = await this.reverify(
      {
        documentKind: dto.documentKind,
        draft,
        caseDetails: dto.caseDetails,
        jurisdiction: dto.jurisdiction,
        offenceDate: dto.offenceDate,
        filingDate: dto.filingDate,
      },
      ctx,
    );
    return { ...reverified, creditsUsed };
  }

  async fillBlanks(
    dto: FillBlanksDto,
    ctx: DraftAuthContext,
  ): Promise<{
    suggestions: Record<string, string>;
    creditsUsed: number;
  }> {
    if (!dto.emptyFields || dto.emptyFields.length === 0) {
      return { suggestions: {}, creditsUsed: 0 };
    }

    const contextStr = Object.entries(dto.context ?? {})
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n');

    const systemPrompt =
      `${draftingRulesForKind(dto.documentKind)}\n\n` +
      'You are filling in blank fields in an Indian court document. ' +
      'Output ONLY a valid JSON object mapping field names to suggested string values. ' +
      'No markdown fences, no explanation outside JSON. ' +
      'Values must be plausible, legally appropriate, and consistent with the known facts. ' +
      'If a field cannot be meaningfully suggested (e.g. specific names/addresses), return an empty string "".';

    const userPrompt = `Document kind: ${dto.documentKind}

Known facts already provided:
${contextStr || '(none)'}

Fields that need AI suggestions (return a JSON object with these keys):
${dto.emptyFields.map((f) => `- "${f}"`).join('\n')}

Rules:
- Legal language only; match the formal register of Indian court pleadings.
- Grounds/contentions should be legally sound arguments, not generic statements.
- Dates: use DD/MM/YYYY format. Year: current year unless context suggests otherwise.
- For verification paras: count the paragraphs and produce correct para numbers.
- For "amount in words": convert the number in context to Indian currency words.

Output a single JSON object like: {"field1": "value", "field2": "value"}`;

    await this.creditLedger.assertSufficientBalance({
      userId: ctx.userId,
      tenantId: ctx.tenantId,
      taskType: AI_TASK_TYPES.DRAFT_VERIFICATION_FIX,
    });

    const fillBlanksModel = this.llm.isProviderConfigured('deepseek')
      ? DEFAULT_ECONOMY_MODEL
      : DEFAULT_AUTO_MODEL;

    const result = await this.llm.complete({
      modelName: fillBlanksModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      maxTokens: 1500,
      temperature: 0.2,
    });

    let suggestions: Record<string, string> = {};
    try {
      const clean = result.content
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```\s*$/, '')
        .trim();
      suggestions = JSON.parse(clean) as Record<string, string>;
    } catch {
      this.logger.warn('IndiaDraft fillBlanks: JSON parse failed, returning empty suggestions');
    }

    const creditsUsed = await this.recordVerificationFixUsage(ctx, {
      documentKind: dto.documentKind,
      instruction: 'fill_blanks',
      modelName: result.modelName,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
    });

    return {
      suggestions,
      creditsUsed,
    };
  }

  async editSelection(
    dto: EditIndiaDraftDto,
    ctx: DraftAuthContext,
  ): Promise<EditIndiaDraftResult> {
    if (dto.instruction === 'check_law') {
      await this.creditLedger.assertSufficientBalance({
        userId: ctx.userId,
        tenantId: ctx.tenantId,
        taskType: AI_TASK_TYPES.DRAFT_VERIFICATION_FIX,
      });

      const gate = this.proceduralGate.check({
        kind: dto.documentKind,
        caseDetails: dto.caseDetails ?? dto.context ?? dto.selectedText,
        countryCode: 'IN',
      });

      const verified = await this.verification.verify({
        draft: dto.selectedText,
        kind: dto.documentKind,
        caseDetails: dto.caseDetails ?? dto.context ?? dto.selectedText,
        jurisdiction: dto.jurisdiction,
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        proceduralWarnings: gate.proceduralWarnings,
        completenessGaps: gate.completenessGaps,
      });

      const accuracyGate = this.buildAccuracyGate(verified.draft, verified.audit, dto.documentKind);
      verified.audit = {
        ...verified.audit,
        canCertify: accuracyGate.canCertify,
        certificationLabel: accuracyGate.certificationLabel,
        unresolvedFacts: accuracyGate.unresolvedFacts,
      };
      const creditsUsed = await this.recordVerificationFixUsage(ctx, {
        documentKind: dto.documentKind,
        instruction: dto.instruction,
        modelName: DEFAULT_AUTO_MODEL,
        inputTokens: Math.ceil((dto.selectedText.length + (dto.caseDetails?.length ?? 0)) / 4),
        outputTokens: 0,
      });

      return {
        revisedText: verified.draft,
        explanation: this.verification.buildVerificationExplanation(verified.audit),
        creditsUsed,
        verification: verified.audit,
        accuracyGate,
      };
    }

    if (dto.instruction === 'add_citations' || dto.instruction === 'strengthen') {
      await this.creditLedger.assertSufficientBalance({
        userId: ctx.userId,
        tenantId: ctx.tenantId,
        taskType: dto.instruction === 'add_citations'
          ? AI_TASK_TYPES.DRAFT_VERIFICATION_FIX
          : AI_TASK_TYPES.DRAFT_SELECTION_EDIT,
      });

      const added = await this.verification.addVerifiedCitations({
        selectedText: dto.selectedText,
        kind: dto.documentKind,
        caseDetails: dto.caseDetails ?? dto.context ?? dto.selectedText,
        jurisdiction: dto.jurisdiction,
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        instruction: dto.instruction,
      });

      const recorded =
        dto.instruction === 'add_citations'
          ? {
              chargedCredits: await this.recordVerificationFixUsage(ctx, {
                documentKind: dto.documentKind,
                instruction: dto.instruction,
                modelName: added.modelName ?? DEFAULT_AUTO_MODEL,
                inputTokens: added.inputTokens ?? 0,
                outputTokens: added.outputTokens ?? 0,
              }),
            }
          : await this.usageRecorder.recordTokenUsage({
              userId: ctx.userId,
              tenantId: ctx.tenantId,
              taskType: AI_TASK_TYPES.DRAFT_SELECTION_EDIT,
              mode: 'AUTO',
              modelName: added.modelName ?? DEFAULT_AUTO_MODEL,
              inputTokens: added.inputTokens ?? 0,
              outputTokens: added.outputTokens ?? 0,
              countryCode: 'IN',
              metadata: { documentKind: dto.documentKind, instruction: dto.instruction },
            });
      const accuracyGate = this.buildAccuracyGate(added.revisedText, added.audit, dto.documentKind);

      return {
        revisedText: added.revisedText,
        explanation: added.explanation,
        creditsUsed: recorded.chargedCredits,
        verification: added.audit,
        accuracyGate,
      };
    }

    const INSTRUCTION_PROMPTS: Record<string, string> = {
      strengthen:
        'Strengthen the legal argument. Add relevant precedents, statutory provisions, or stronger grounds. Maintain the formal register.',
      make_formal:
        'Make the language more formal and court-appropriate. Replace colloquial phrases with precise legal language.',
      make_concise:
        'Make the text more concise without losing substance. Remove redundancy.',
      check_law:
        'Review the statutory references and case law cited. Correct any outdated section numbers (update IPC to BNS, CrPC to BNSS where applicable).',
      add_citations:
        'Insert only verified case citations from the corpus-backed authorities provided.',
      expand_grounds:
        'Expand the grounds. Add more specific factual and legal particulars.',
      rephrase:
        'Rephrase this passage in better legal English while preserving all substance.',
      fix_grammar:
        'Fix grammar and syntax errors. Keep all legal terminology intact.',
    };

    const instructionText =
      INSTRUCTION_PROMPTS[dto.instruction] ??
      dto.instruction;

    const systemPrompt =
      `${draftingRulesForKind(dto.documentKind)}\n\n` +
      'You are editing a specific passage in an Indian court document. ' +
      'Return ONLY the revised passage — do not include any explanation in the revised text itself. ' +
      'After the revised text, append a single line starting with "EXPLANATION:" followed by a brief note on what you changed.';

    const userPrompt = `Document kind: ${dto.documentKind}

Instruction: ${instructionText}

${dto.context ? `Surrounding context (do not modify this, just for reference):\n"${dto.context}"\n\n` : ''}Selected passage to revise:
"${dto.selectedText}"

Output format:
<revised passage here>
EXPLANATION: <brief note>`;

    await this.creditLedger.assertSufficientBalance({
      userId: ctx.userId,
      tenantId: ctx.tenantId,
      taskType: AI_TASK_TYPES.DRAFT_SELECTION_EDIT,
    });

    const result = await this.llm.complete({
      modelName: DEFAULT_AUTO_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      maxTokens: 1000,
      temperature: 0.3,
    });

    const parts = result.content.split(/\nEXPLANATION:/i);
    const revisedText = (parts[0] ?? result.content).trim();
    const explanation = parts[1]?.trim() ?? 'Text revised as requested.';

    const verified = await this.verification.verify({
      draft: revisedText,
      kind: dto.documentKind,
      caseDetails: dto.caseDetails ?? dto.context ?? dto.selectedText,
      jurisdiction: dto.jurisdiction,
      tenantId: ctx.tenantId,
      userId: ctx.userId,
    });

    const recorded = VERIFICATION_FIX_INSTRUCTIONS.has(dto.instruction)
      ? {
          chargedCredits: await this.recordVerificationFixUsage(ctx, {
            documentKind: dto.documentKind,
            instruction: dto.instruction,
            modelName: result.modelName,
            inputTokens: result.inputTokens,
            outputTokens: result.outputTokens,
          }),
        }
      : await this.usageRecorder.recordTokenUsage({
          userId: ctx.userId,
          tenantId: ctx.tenantId,
          taskType: AI_TASK_TYPES.DRAFT_SELECTION_EDIT,
          mode: 'AUTO',
          modelName: result.modelName,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          countryCode: 'IN',
          metadata: { documentKind: dto.documentKind, instruction: dto.instruction },
        });
    const accuracyGate = this.buildAccuracyGate(verified.draft, verified.audit, dto.documentKind);
    verified.audit = {
      ...verified.audit,
      canCertify: accuracyGate.canCertify,
      certificationLabel: accuracyGate.certificationLabel,
      unresolvedFacts: accuracyGate.unresolvedFacts,
    };

    return {
      revisedText: verified.draft,
      explanation,
      creditsUsed: recorded.chargedCredits,
      verification: verified.audit,
      accuracyGate,
    };
  }

  async exportDraft(
    dto: ExportIndiaDraftDto,
    ctx: DraftAuthContext,
  ): Promise<{ html: string }> {
    if (dto.exportMode === 'filing') {
      if (!dto.draftId) {
        throw new BadRequestException(
          'A persisted draft and filing-readiness report are required for filing export.',
        );
      }
      const record = await this.draftHistory.getById(
        dto.draftId,
        ctx.tenantId,
        ctx.userId,
      );
      const readiness = record.verificationAudit?.filingReadiness;
      const automatedChecksBlocked = Object.entries(readiness?.checks ?? {}).some(
        ([check, status]) => check !== 'humanReview' && status === 'blocked',
      );
      const nonReviewBlockers = (readiness?.mandatoryBlockers ?? []).filter(
        (blocker) => !/human|lawyer|advocate\s+review/i.test(blocker),
      );
      if (!readiness || automatedChecksBlocked || nonReviewBlockers.length > 0) {
        throw new BadRequestException(
          'Filing export blocked: mandatory automated accuracy checks remain unresolved.',
        );
      }
    }
    const appendixHtml =
      dto.citationAppendix && dto.citationAppendix.length > 0
        ? this.citationAppendixBuilder.renderTableOfAuthoritiesHtml(
            dto.citationAppendix as import('@/ai/citations/citation-appendix-builder.service').RichCitationAppendixEntry[],
          )
        : '';

    const html = renderDocumentHtml({
      plainText: dto.html,
      documentKind: dto.documentKind,
      tableOfAuthoritiesHtml: appendixHtml,
    });
    return { html };
  }

  /**
   * If the LLM hit its token limit, run continuation passes until the document
   * ends naturally (finish_reason = 'stop') or we reach maxContinuations.
   * Each continuation pass charges DRAFT_CONTINUATION credits.
   */
  private async continueIfTruncated(
    initial: { content: string; finishReason: string },
    systemPrompt: string | LlmSystemBlock[],
    modelName: string,
    userId: string,
    tenantId: string,
    maxContinuations = 3,
  ): Promise<string> {
    let full = initial.content;
    let currentFinishReason = initial.finishReason;
    let count = 0;

    while (
      (currentFinishReason === 'max_tokens' || currentFinishReason === 'length') &&
      count < maxContinuations
    ) {
      this.logger.log(`Draft truncated (pass ${count + 1}), continuing from token limit`);

      const isBlockArray = Array.isArray(systemPrompt);
      const continuation = await this.llm.complete({
        modelName,
        messages: [
          ...(isBlockArray ? [] : [{ role: 'system' as const, content: systemPrompt as string }]),
          {
            role: 'user',
            content: `Continue the legal document exactly from where you stopped. Do NOT repeat any content already written. The document so far ends with:\n\n...${full.slice(-600)}\n\nContinue from here:`,
          },
        ],
        ...(isBlockArray ? { systemBlocks: systemPrompt as LlmSystemBlock[] } : {}),
        maxTokens: 6000,
        temperature: 0.1,
      });

      full += continuation.content;
      currentFinishReason = continuation.finishReason;
      count++;

      // Meter continuation usage using the same 2× provider-cost policy.
      try {
        const continuationCharge = this.computeVerificationFixCharge({
          modelName,
          inputTokens: continuation.inputTokens,
          outputTokens: continuation.outputTokens,
        });
        await this.creditLedger.debit({
          userId,
          tenantId,
          taskType: AI_TASK_TYPES.DRAFT_CONTINUATION,
          credits: continuationCharge.credits,
          costUsd: continuationCharge.providerCostUsd,
          metadata: { continuationPass: count, modelName },
        });
      } catch {
        // Non-fatal — don't fail the draft if credit debit fails here
      }
    }

    return full;
  }

  /**
   * Targeted section regeneration (v2 engine only).
   *
   * Accepts the original generation inputs + the sectionId that needs repair,
   * re-runs the full v2 pipeline, and returns the single regenerated SectionResult.
   * The caller (frontend) replaces only that section in its local document state.
   */
  async regenerateSection(
    dto: RegenerateSectionDto,
    ctx: DraftAuthContext,
  ): Promise<SectionResult> {
    if (!isDraftEngineV2Enabled()) {
      throw new BadRequestException('Section regeneration requires DRAFT_ENGINE_V2=true');
    }

    const kind = ensureIndiaDraftKind(dto.kind);
    const brief = this.caseBriefService.extract(dto.caseDetails ?? '', kind);

    // Run the full pipeline to get a fresh DocumentOutline and sections
    const v2Result = await this.draftEngineV2.generate(
      {
        kind: dto.kind,
        caseDetails: dto.caseDetails,
        clientName: dto.clientName,
        courtName: dto.courtName,
        opposingParty: dto.opposingParty,
        jurisdiction: dto.jurisdiction,
        practiceArea: dto.practiceArea,
        attachmentContext: dto.attachmentContext,
        pinnedSections: dto.pinnedSections,
        pinnedCaseLaws: dto.pinnedCaseLaws,
      },
      ctx,
    );

    const section = v2Result.sections.find((s) => s.sectionId === dto.sectionId);
    if (!section) {
      throw new BadRequestException(`Section ${dto.sectionId} not found in regenerated document`);
    }

    // Section verify: timeline + fact coverage + citation presence for grounds
    const timelineFindings = this.timelineValidator.evaluate({
      draft: section.content,
      caseDetails: dto.caseDetails,
      kind,
      brief,
    });
    const coverage = this.factCoverage.evaluate({
      draft: section.content,
      brief,
      kind,
      filingGrade: this.playbooks.isFilingGrade(kind),
    });
    const briefWarnings = [
      ...timelineFindings.map((f) => f.explanation),
      ...coverage.findings
        .filter((f) => f.severity === 'BLOCKER' || f.severity === 'HIGH')
        .map((f) => f.explanation),
    ];
    const needsReview =
      timelineFindings.some((f) => f.severity === 'BLOCKER') ||
      coverage.groundsWithoutCitation.length > 0;

    return {
      ...section,
      verificationWarnings: [...section.verificationWarnings, ...briefWarnings],
      verificationStatus: needsReview ? 'needs_review' : section.verificationStatus,
      explainability: {
        ...section.explainability,
        whyIncluded: `${section.explainability.whyIncluded} [Case Brief verified; fact coverage ${(coverage.coverageRate * 100).toFixed(0)}%]`,
      },
    };
  }

  async resolveCaseLaw(dto: ResolveCaseLawDto, ctx: DraftAuthContext) {
    return this.researchGrounding.resolveCaseLaw({
      citation: dto.citation,
      caseName: dto.caseName,
      holding: dto.holding,
      kind: dto.kind,
      jurisdiction: dto.jurisdiction,
      allowSoftPin: dto.allowSoftPin,
      tenantId: ctx.tenantId,
      userId: ctx.userId,
    });
  }
}