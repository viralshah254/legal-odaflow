/**
 * Draft Engine v2.0 — Main Orchestrator
 *
 * Implements the full 12-stage Legal Operating System pipeline:
 *
 * Stage 1: Matter Intelligence (existing MatterIntelligencePipelineService)
 * Stage 2: Planning Engine → LegalPlan
 * Stage 3: Legal Knowledge Graph → verified law context
 * Stage 4: Multi-source Retrieval (existing DraftResearchGroundingService)
 * Stage 5: Rule Engine → deterministic legal facts
 * Stage 6: Outline Builder → DocumentOutline (addressable SectionPlan nodes)
 * Stage 7: Evidence Validation → per-argument evidence status
 * Stage 8: Section Generator → parallel independent section generation
 * Stage 9: Citation Grounding + Confidence Engine → per-paragraph scores
 * Stage 10: Section Verifier → per-section verification
 * Stage 11: Targeted Repair → regenerate only failing sections
 * Stage 12: Final Assembly → merged document + reports
 *
 * Activated by the DRAFT_ENGINE_V2=true feature flag.
 * Legacy path (IndiaDraftService) remains the default until parity is proven.
 */

import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { IndiaDraftGroundingService } from '@/ai/india-draft/india-draft-grounding.service';
import { DraftResearchGroundingService } from '@/ai/drafting/draft-research-grounding.service';
import { DraftingIntelligenceMapService } from '@/ai/drafting/drafting-intelligence-map.service';
import { DraftCaseBriefService } from '@/ai/drafting/draft-case-brief.service';
import { DraftCaseTheoryService } from '@/ai/drafting/draft-case-theory.service';
import { DraftCoherenceReviewService } from '@/ai/drafting/draft-coherence-review.service';
import { DRAFT_ENRICH_MODEL } from '@/ai/model-costs.config';
import { DraftProceduralRouterService } from '@/ai/drafting/draft-procedural-router.service';
import { DraftProceduralGateService } from '@/ai/drafting/draft-procedural-gate.service';
import { DocumentDependencyService } from '@/ai/matter-intelligence/document-dependency.service';
import { MatterIntelligencePipelineService } from '@/ai/matter-intelligence/matter-intelligence-pipeline.service';
import { MatterMemoryService } from '@/ai/matter-intelligence/matter-memory.service';
import { CourtDraftHistoryService } from '@/ai/drafting/court-draft-history.service';
import { AiCreditEnforcementService } from '@/ai-credits/ai-credit-enforcement.service';
import { AICreditLedgerService } from '@/ai-credits/ai-credit-ledger.service';
import { AiUsageRecorderService } from '@/ai/ai-usage-recorder.service';
import { AI_TASK_TYPES } from '@/ai-credits/task-types';
import { DRAFT_PREMIUM_MODEL } from '@/ai/model-costs.config';
import { DraftComplexityService } from './draft-complexity.service';
import { ensureIndiaDraftKind, isExplicitIndiaCatalogKind } from '@/ai/india-draft/india-draft-kind.utils';
import { isExpressIndiaDraftKind } from '@/ai/india-draft/india-draft-express';
import { isHybridNoticeWithCaseLaw, wantsCaseLaw } from '@/ai/drafting/draft-citation-policy';
import { isMiEnabled } from '@/ai/matter-intelligence/mi-feature-flags';
import type { EvidenceRef } from '@/ai/matter-intelligence/matter-intelligence.types';

import { PlanningEngineService } from './planning-engine.service';
import { OutlineBuilderService } from './outline-builder.service';
import { SectionGeneratorService } from './section-generator.service';
import { ConfidenceEngineService } from './confidence-engine.service';
import { SectionVerifierService } from './section-verifier.service';
import { TargetedRepairService } from './targeted-repair.service';
import { EvidenceValidationService } from './evidence-validation.service';
import { FinalAssemblyService } from './final-assembly.service';
import { RuleEngineService } from './rule-engine/rule-engine.service';
import { LegalGraphService } from './legal-graph/legal-graph.service';
import { DraftingV2MetricsService } from './drafting-v2-metrics.service';
import { SimilarCasesService } from '@/ai/legal-research/similar-cases.service';
import { LegalSectionRouterService } from '@/ai/legal-section-router.service';
import type {
  DraftV2Input,
  DraftV2Context,
  DraftV2Result,
  SectionPlan,
  SectionResult,
  DocumentOutline,
} from './drafting-v2.types';

/** Check the global v2 feature flag. */
export function isDraftEngineV2Enabled(): boolean {
  return process.env.DRAFT_ENGINE_V2 === 'true';
}

/**
 * Forms where v2 is always preferred regardless of the global flag.
 * These are citation-heavy dispute forms where per-section authority grounding
 * and the citation appendix provide significantly better output quality.
 */
const V2_PREFERRED_KINDS = new Set([
  'india_suit_recovery_cpc_37',
  'india_regular_bail_bnss_480',
  'india_anticipatory_bail_bnss_482',
  'india_maintenance_order_revision',
  'india_maintenance_appeal_final',
  'india_maintenance_application_bnss_144',
  'india_writ_petition_hc',
  'india_slp_draft',
  'india_criminal_revision',
  'india_criminal_appeal',
  'india_divorce_petition_s13',
  'india_suit_specific_performance',
  'india_application_temp_injunction',
  'india_arbitration_petition_s9',
  'india_award_challenge_s34',
  'india_wrongful_termination_petition',
]);

/**
 * Returns true if the v2 engine should handle this draft kind.
 * Respects the global flag first, then falls back to per-kind routing.
 * Express/notice kinds are never routed to v2 automatically.
 */
export function shouldUseV2ForKind(kind: string): boolean {
  if (isDraftEngineV2Enabled()) return true;
  // Only use per-kind routing if the feature is enabled separately or if per-kind flag is set.
  if (process.env.DRAFT_ENGINE_V2_PER_KIND !== 'true') return false;
  return V2_PREFERRED_KINDS.has(kind);
}

@Injectable()
export class DraftEngineV2Service {
  private readonly logger = new Logger(DraftEngineV2Service.name);

  constructor(
    // Stage 1 — Matter Intelligence (existing)
    private readonly matterPipeline: MatterIntelligencePipelineService,
    private readonly matterMemory: MatterMemoryService,
    // Stage 2 — Planning
    private readonly planningEngine: PlanningEngineService,
    // Stage 3 — Legal Graph
    private readonly legalGraph: LegalGraphService,
    // Stage 4 — Retrieval (existing)
    private readonly groundingService: IndiaDraftGroundingService,
    private readonly researchGrounding: DraftResearchGroundingService,
    private readonly draftingIntelligenceMap: DraftingIntelligenceMapService,
    private readonly caseBriefService: DraftCaseBriefService,
    private readonly caseTheory: DraftCaseTheoryService,
    private readonly coherenceReview: DraftCoherenceReviewService,
    // Stage 5 — Rule Engine
    private readonly ruleEngine: RuleEngineService,
    // Stage 6 — Outline Builder
    private readonly outlineBuilder: OutlineBuilderService,
    // Stage 7 — Evidence Validation
    private readonly evidenceValidation: EvidenceValidationService,
    // Stage 8 — Section Generator
    private readonly sectionGenerator: SectionGeneratorService,
    // Stage 9 — Confidence Engine
    private readonly confidenceEngine: ConfidenceEngineService,
    // Stage 10 — Section Verifier
    private readonly sectionVerifier: SectionVerifierService,
    // Stage 11 — Targeted Repair
    private readonly targetedRepair: TargetedRepairService,
    // Stage 12 — Final Assembly
    private readonly finalAssembly: FinalAssemblyService,
    // Supporting infrastructure
    private readonly proceduralRouter: DraftProceduralRouterService,
    private readonly proceduralGate: DraftProceduralGateService,
    private readonly documentDependency: DocumentDependencyService,
    private readonly draftHistory: CourtDraftHistoryService,
    private readonly creditLedger: AICreditLedgerService,
    private readonly creditEnforcement: AiCreditEnforcementService,
    private readonly usageRecorder: AiUsageRecorderService,
    // Metrics + observability
    private readonly metricsService: DraftingV2MetricsService,
    // Complexity classification
    private readonly draftComplexity: DraftComplexityService,
    // Similar cases ranking (for verification audit panel)
    private readonly similarCasesService: SimilarCasesService,
    private readonly legalSectionRouter: LegalSectionRouterService,
  ) {}

  async generate(
    dto: DraftV2Input,
    ctx: DraftV2Context,
  ): Promise<DraftV2Result> {
    const startMs = Date.now();
    let stageStarted = startMs;
    const stageDurationsMs: Record<string, number> = {};
    const finishStage = (stage: string) => {
      const now = Date.now();
      stageDurationsMs[stage] = now - stageStarted;
      this.logger.log(JSON.stringify({ event: 'draft_v2_stage', stage, durationMs: stageDurationsMs[stage] }));
      stageStarted = now;
    };
    const userKind = ensureIndiaDraftKind(dto.kind);
    const respectUserSelection = isExplicitIndiaCatalogKind(userKind);
    const bundleSubsequent = Boolean(dto.bundleMode && (dto.bundleIndex ?? 0) > 0);

    // ── Stage 1: Matter Intelligence ──────────────────────────────────────────
    let miProfile: Awaited<ReturnType<MatterIntelligencePipelineService['run']>>['profile'] | undefined;
    let miKindOverride: string | undefined;
    let suppliedEvidence: EvidenceRef[] = [];

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
      // Extract evidence refs from matter graph
      suppliedEvidence = (miResult.graph?.evidence ?? []) as EvidenceRef[];
    }

    // ── Stage 9 Legal Memory (Phase 9) — reuse prior extractions ─────────────
    // (matter-memory is queryable by matter/session ID; in court draft flow
    // we don't have a matter ID so we skip memory load here; future phases
    // will wire this via matter linking)

    // Procedural routing
    let routerResult = this.proceduralRouter.route({
      kind: respectUserSelection ? userKind : ensureIndiaDraftKind(miKindOverride ?? dto.kind),
      caseDetails: dto.caseDetails,
      countryCode: 'IN',
      courtName: dto.courtName,
      respectUserSelection,
    });
    routerResult = this.legalSectionRouter.enrichProceduralResult(routerResult, {
      consumer: 'drafting_v2',
      countryCode: 'IN',
      documentKind: routerResult.recommendedKind,
      rawFacts: dto.caseDetails,
      courtName: dto.courtName,
    });
    const effectiveKind = respectUserSelection ? userKind : routerResult.recommendedKind;

    // ── Complexity classification ──────────────────────────────────────────────
    const modelMode = dto.modelMode ?? 'AUTO';
    const docComplexity = this.draftComplexity.classify({
      kind: effectiveKind,
      caseDetails: dto.caseDetails,
      proceduralOverridden: routerResult.kindOverridden,
      modelMode,
    });

    // Pre-draft dependency gate
    const preDraftGate = this.documentDependency.checkPreDraft(userKind, [
      dto.caseDetails,
      dto.attachmentContext ?? '',
    ]);
    if (!preDraftGate.canProceed) {
      throw Object.assign(new Error(preDraftGate.message ?? 'Missing required inputs'), {
        status: 400,
        missingInputs: preDraftGate.missingInputs,
      });
    }

    const matterProfile = miProfile ?? {
      country: 'IN',
      practiceArea: dto.practiceArea ?? 'litigation_disputes',
      nature: 'dispute' as const,
      remedies: [],
      issues: [],
      documentTypes: [effectiveKind],
      documentKind: effectiveKind,
      curatedKinds: [effectiveKind],
      confidence: 0.7,
      jurisdiction: dto.jurisdiction,
    };

    const expressMode = isExpressIndiaDraftKind(effectiveKind);
    // Hybrid notices are formally express kinds (legal notice, demand letter) but
    // contain litigious case details (e.g. bail, maintenance) that benefit from
    // case-law grounding. V1 has this guard; V2 was missing it.
    const hybridNoticeCaseLaw = isHybridNoticeWithCaseLaw(effectiveKind, dto.caseDetails);
    const skipResearchGrounding =
      expressMode &&
      !hybridNoticeCaseLaw &&
      !dto.formNumber?.trim() &&
      !(dto.pinnedCaseLaws?.length) &&
      !wantsCaseLaw(dto.knowledgeSources);

    finishStage('matterIntelligenceAndRouting');

    // Independent planning calls share the same authorized facts; neither consumes
    // the other's output. Await both together before retrieval.
    const [caseTheory, mapResult] = await Promise.all([
      this.caseTheory.build({
        facts: dto.caseDetails ?? '',
        documentKind: effectiveKind,
        countryCode: 'IN',
        jurisdiction: dto.jurisdiction,
        caseBrief: this.caseBriefService.extract(dto.caseDetails ?? '', effectiveKind),
        model: DRAFT_ENRICH_MODEL,
        filingGrade: !skipResearchGrounding,
      }),
      (async () => {
        let mapQueries: string[] = [];
        let mapIssues: Array<{ id: string; label: string; kind?: string }> = [];
        if (!skipResearchGrounding && dto.caseDetails?.trim() && !bundleSubsequent) {
          try {
            const draftingMap = await this.draftingIntelligenceMap.buildMap({
              caseDetails: dto.caseDetails,
              countryCode: 'IN',
              jurisdiction: dto.jurisdiction,
              kind: effectiveKind,
              practiceArea: matterProfile.practiceArea,
            });
            mapQueries = [...new Set([...draftingMap.researchQueries, ...draftingMap.searchHints])].slice(0, 12);
            mapIssues = draftingMap.issues.map((i) => ({ id: i.id, label: i.label, kind: i.kind }));
          } catch (err) {
            this.logger.warn(`Drafting intelligence map skipped: ${err instanceof Error ? err.name : 'unknown error'}`);
          }
        }
        return { mapQueries, mapIssues };
      })(),
    ]);
    const { mapQueries, mapIssues } = mapResult;
    const caseTheoryQueries = this.caseTheory.buildAuthorityQueries(caseTheory, {
      documentKind: effectiveKind,
      jurisdiction: dto.jurisdiction,
    });

    finishStage('planning');

    // ── Stage 5: Rule Engine (before planning) ────────────────────────────────
    const ruleResult = this.ruleEngine.evaluate({
      documentKind: effectiveKind,
      countryCode: 'IN',
      jurisdiction: dto.jurisdiction,
      practiceArea: matterProfile.practiceArea,
      caseDetails: dto.caseDetails,
    });

    // ── Stage 2: Planning Engine (uses map issues when present) ────────────────
    const plan = this.planningEngine.plan(
      dto,
      matterProfile,
      routerResult,
      ruleResult,
      mapIssues,
    );

    // ── Stage 3: Legal Knowledge Graph ────────────────────────────────────────
    const legalGraphSummary = await this.legalGraph.getIssueSummary(effectiveKind, 'IN');

    // Enrich plan issues from Knowledge Graph
    if (legalGraphSummary.ingredients.length > 0) {
      for (const issue of plan.issues) {
        issue.requiredIngredients = [
          ...new Set([...issue.requiredIngredients, ...legalGraphSummary.ingredients]),
        ];
      }
    }
    if (legalGraphSummary.requiredEvidence.length > 0) {
      plan.requiredEvidence = [
        ...new Set([...plan.requiredEvidence, ...legalGraphSummary.requiredEvidence]),
      ];
    }

    finishStage('rulesAndLegalGraph');

    // ── Stage 4: Multi-source Retrieval (map-driven queries) ──────────────────
    const [statuteGroundingText, researchGroundingResult] = await Promise.all([
      this.groundingService.buildGroundingBlock(
        effectiveKind,
        dto.caseDetails,
        routerResult.governingSections,
        dto.pinnedSections ?? [],
      ),
      skipResearchGrounding
        ? Promise.resolve({
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
            userId: ctx.userId,
            tenantRole: ctx.tenantRole,
            matterId: dto.matterId,
            proceduralResult: routerResult,
            bundleFastPath: bundleSubsequent,
            hybridExpressNotice: hybridNoticeCaseLaw,
            // Gate expensive deep-research ReAct loop: only for complex/PREMIUM drafts
            skipDeepResearch: !this.draftComplexity.requiresDeepResearch(docComplexity),
            formNumber: dto.formNumber,
            formTitle: dto.formTitle,
            pinnedCaseLaws: dto.pinnedCaseLaws,
            knowledgeSources: dto.knowledgeSources,
            extraRetrievalQueries: [...new Set([...caseTheoryQueries, ...mapQueries])].slice(0, 14),
          }),
    ]);

    finishStage('retrieval');

    // ── Stage 6: Outline Builder ──────────────────────────────────────────────
    const outline = this.outlineBuilder.build(
      plan,
      {
        authorities: researchGroundingResult.authorities,
        statuteGrounding: statuteGroundingText,
      },
      dto,
      matterProfile,
      routerResult,
    );

    // ── Stage 7: Evidence Validation ──────────────────────────────────────────
    const evidenceReport = this.evidenceValidation.validate(plan, outline, suppliedEvidence);

    const evidenceValidationBySectionId = new Map(
      evidenceReport.sections.map((s) => [s.sectionId, s]),
    );

    // ── Credit gate ───────────────────────────────────────────────────────────
    await this.creditLedger.assertSufficientBalance({
      userId: ctx.userId,
      tenantId: ctx.tenantId,
      taskType: AI_TASK_TYPES.INDIA_COURT_DRAFT,
    });

    finishStage('outlineAndCreditGate');

    // ── Stages 8–11: Generate + Verify + Repair sections ─────────────────────
    const sectionResults = await this.generateAndVerifySections(
      outline,
      evidenceValidationBySectionId,
      ctx,
      docComplexity,
      modelMode,
    );

    finishStage('sections');

    // ── Stage 12: Final Assembly ──────────────────────────────────────────────
    // Compute credits
    const totalInputTokens = sectionResults.reduce((s, r) => s + r.tokensUsed.input, 0);
    const totalOutputTokens = sectionResults.reduce((s, r) => s + r.tokensUsed.output, 0);

    const recorded = await this.usageRecorder.recordTokenUsage({
      userId: ctx.userId,
      tenantId: ctx.tenantId,
      taskType: AI_TASK_TYPES.INDIA_COURT_DRAFT,
      mode: 'PREMIUM',
      modelName: DRAFT_PREMIUM_MODEL,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      countryCode: 'IN',
      metadata: {
        kind: effectiveKind,
        engineVersion: 'v2',
        sectionCount: sectionResults.length,
        repairCount: sectionResults.reduce((s, r) => s + r.repairAttempts, 0),
      },
    });

    const assembled = this.finalAssembly.assemble(
      sectionResults,
      outline,
      plan,
      evidenceReport,
      ruleResult,
      recorded.chargedCredits,
      researchGroundingResult.authorities,
      dto.caseDetails ?? '',
    );

    // Senior-partner read over the assembled filing, shared with the other engines.
    const coherence = await this.coherenceReview.review({
      draft: assembled.draft,
      documentKind: effectiveKind,
      countryCode: 'IN',
      jurisdiction: dto.jurisdiction,
      caseTheoryPromptBlock: this.caseTheory.buildPromptBlock(caseTheory),
      model: DRAFT_ENRICH_MODEL,
      // Keep section verification attached to the exact generated text. Final
      // review reports issues; targeted repair is an explicit subsequent action.
      allowRevision: false,
    });
    if (coherence.revisedDraft) assembled.draft = coherence.revisedDraft;
    this.finalAssembly.applyFinalReview(
      assembled.verificationReport,
      Boolean(coherence.revisedDraft),
      [
        ...coherence.issues.filter((issue) => issue.severity === 'BLOCKER' || issue.severity === 'HIGH')
          .map((issue) => `Coherence [${issue.category}]: ${issue.explanation}`),
        ...(coherence.degraded ? ['Final coherence review unavailable; lawyer review required.'] : []),
      ],
    );

    finishStage('assemblyAndFinalReview');

    const similarCases = this.similarCasesService.extractAndRank(
      researchGroundingResult.authorities,
      `${effectiveKind} ${dto.caseDetails ?? ''}`.trim(),
      'IN',
      3,
    );

    // Persist draft history
    let draftId: string | undefined;
    try {
      const saved = await this.draftHistory.save({
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        source: 'india',
        tenantRole: ctx.tenantRole,
        matterId: dto.matterId,
        kind: effectiveKind,
        label: plan.documentTitle,
        countryCode: 'IN',
        jurisdiction: dto.jurisdiction,
        language: dto.language ?? 'en',
        caseDetails: dto.caseDetails,
        clientName: dto.clientName,
        courtName: dto.courtName,
        opposingParty: dto.opposingParty,
        draftText: assembled.draft,
        verificationAudit: {
          corrections: [],
          similarCases: similarCases,
          sectionChecks: { entries: [], anyCorrections: false, anyUnconfirmedMismatches: false },
          citationWarnings: assembled.verificationReport.overallWarnings,
          strippedCitations: [],
          proceduralWarnings: routerResult.proceduralWarnings,
          completenessGaps: routerResult.completenessGaps,
          requiresLawyerReview: assembled.verificationReport.requiresLawyerReview,
          verificationStatus: assembled.verificationReport.status,
          canCertify: assembled.verificationReport.canCertify,
          certificationLabel: assembled.verificationReport.certificationLabel,
        },
        creditsUsed: recorded.chargedCredits,
      });
      draftId = saved.id;
    } catch (err) {
      this.logger.warn(`Failed to persist draft history: ${err instanceof Error ? err.message : String(err)}`);
    }

    const result: DraftV2Result = {
      ...assembled,
      draftId,
      similarCases,
      proceduralDetermination: {
        recommendedKind: routerResult.recommendedKind,
        userSelectedKind: routerResult.userSelectedKind,
        kindOverridden: routerResult.kindOverridden,
        maintainabilityNotes: routerResult.maintainabilityNotes,
        governingSections: routerResult.governingSections,
      },
      researchPhase: {
        retrievalConfidence: researchGroundingResult.retrievalConfidence,
        usedDeepResearch: researchGroundingResult.usedDeepResearch,
        authorityCount: researchGroundingResult.authorities.length,
      },
    };

    // ── Metrics recording (Phase 10) ──────────────────────────────────────────
    this.metricsService.recordGeneration(result, {
      draftId: draftId ?? randomUUID(),
      documentKind: effectiveKind,
      jurisdiction: dto.jurisdiction ?? 'IN',
      latencyMs: Date.now() - startMs,
      stageDurationsMs,
    });

    // Shadow-mode divergence: if MI recommended a different kind, log it
    if (miKindOverride && miKindOverride !== userKind) {
      this.metricsService.recordShadowComparison({
        draftId: draftId ?? '',
        documentKind: effectiveKind,
        jurisdiction: dto.jurisdiction ?? 'IN',
        v1VerificationStatus: 'n/a',
        v2OverallConfidence: assembled.confidenceReport.overallScore,
        v2OverallGrade: assembled.confidenceReport.overallGrade,
        v2RepairCount: assembled.confidenceReport.totalRepairs,
        divergenceDetails: [`MI recommended ${miKindOverride}; user selected ${userKind}`],
      });
    }

    return result;
  }

  // ── Stages 8–11 Orchestrator ──────────────────────────────────────────────

  private async generateAndVerifySections(
    outline: DocumentOutline,
    evidenceValidationBySectionId: Map<string, import('./drafting-v2.types').SectionEvidenceValidation>,
    ctx: DraftV2Context,
    docComplexity: 'simple' | 'standard' | 'complex' = 'complex',
    modelMode: 'AUTO' | 'PREMIUM' = 'AUTO',
  ): Promise<SectionResult[]> {
    const results = new Map<string, SectionResult>();
    const contentMap = new Map<string, string>();
    const authorities = outline.globalContext.verifiedAuthorities;
    const caseDetails = outline.globalContext.caseDetails;

    // Resolve execution order via topological sort of dependencies
    const orderedSections = topologicalSort(outline.sections);

    for (const batch of orderedSections) {
      // Generate all sections in this batch in parallel
      const batchResults = await Promise.all(
        batch.map(async (section): Promise<SectionResult> => {
          const evidenceValidation = evidenceValidationBySectionId.get(section.id);

          // Stage 8: Generate section
          let generated: { content: string; modelUsed: string; inputTokens: number; outputTokens: number };
          try {
            generated = await this.sectionGenerator.generateSection(
              section,
              outline,
              contentMap,
              evidenceValidation,
              docComplexity,
              modelMode,
            );
          } catch (err) {
            this.logger.error(`Generation failed for section ${section.id}: ${err instanceof Error ? err.message : String(err)}`);
            return this.buildFailedSection(section, `Generation failed: ${err instanceof Error ? err.message : 'unknown error'}`);
          }

          // Stage 9: Confidence scoring
          const { confidence, evidenceChains } = this.confidenceEngine.computeSectionConfidence(
            generated.content,
            authorities,
            section,
          );

          // Stage 10: Verify section
          let sectionResult = await this.sectionVerifier.verify(
            section,
            generated.content,
            caseDetails,
            'IN',
            authorities,
            confidence,
            evidenceChains,
            generated.modelUsed,
            { input: generated.inputTokens, output: generated.outputTokens },
          );

          // Stage 11: Targeted repair if needed
          if (
            sectionResult.verificationStatus === 'repair_needed' ||
            this.confidenceEngine.needsRepair(sectionResult.confidence, section)
          ) {
            sectionResult = await this.targetedRepair.repairSection(
              sectionResult,
              section,
              outline,
              contentMap,
              caseDetails,
              'IN',
              authorities,
              evidenceValidation,
            );
          }

          return sectionResult;
        }),
      );

      for (let i = 0; i < batch.length; i++) {
        const section = batch[i];
        const result = batchResults[i];
        results.set(section.id, result);
        contentMap.set(section.id, result.content);
      }
    }

    return [...results.values()];
  }

  private buildFailedSection(section: SectionPlan, message: string): SectionResult {
    return {
      sectionId: section.id,
      type: section.type,
      title: section.title,
      content: `[SECTION GENERATION FAILED — ${message}]`,
      confidence: {
        score: 0,
        grade: 'unverified',
        citationVerified: false,
        groundedSentenceRate: 0,
        ungroundedCount: 0,
        contradictions: 0,
        signals: ['Generation failure'],
      },
      evidenceChains: [],
      verificationStatus: 'repair_failed',
      repairAttempts: 0,
      verificationWarnings: [message],
      citationWarnings: [],
      modelUsed: 'none',
      tokensUsed: { input: 0, output: 0 },
      explainability: {
        whyIncluded: 'Generation failed',
        applicableLaw: [],
        applicableEvidence: [],
        applicableCases: [],
        applicableRules: [],
      },
      isInjectedBoilerplate: false,
    };
  }
}

// ─── Topological sort ────────────────────────────────────────────────────────

/**
 * Returns sections grouped by execution wave (batches that can run in parallel).
 * Wave 0: sections with no dependencies.
 * Wave N: sections whose all dependencies are in waves 0..N-1.
 */
function topologicalSort(sections: SectionPlan[]): SectionPlan[][] {
  const completed = new Set<string>();
  const batches: SectionPlan[][] = [];
  const remaining = [...sections];

  while (remaining.length > 0) {
    const batch = remaining.filter(
      (s) => s.dependsOn.every((depId) => completed.has(depId)),
    );

    if (batch.length === 0) {
      // Cycle or unresolvable deps — add all remaining as a single batch
      batches.push([...remaining]);
      break;
    }

    batches.push(batch);
    for (const s of batch) {
      completed.add(s.id);
    }
    for (const s of batch) {
      const idx = remaining.indexOf(s);
      if (idx !== -1) remaining.splice(idx, 1);
    }
  }

  return batches;
}
