import { Module, forwardRef } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { AgentsModule } from '@/agents/agents.module';
import { AiCreditsModule } from '@/ai-credits/ai-credits.module';
import { AuditModule } from '@/audit/audit.module';
import { CountryComplianceModule } from '@/country-compliance/country-compliance.module';
import { ClientsModule } from '@/clients/clients.module';
import { CreditsModule } from '@/credits/credits.module';
import { LegalComplianceModule } from '@/legal-compliance/legal-compliance.module';
import { FirmMemoryModule } from '@/firm-memory/firm-memory.module';
import { LegalSourcesModule } from '@/legal-sources/legal-sources.module';
import { LegalSearchModule } from '@/legal-search/legal-search.module';
import { LegalResearchVerificationService } from '@/legal-search/legal-research-verification.service';
import { DeepResearchAgentService } from '@/legal-search/deep-research-agent.service';
import { OcrModule } from '@/ocr/ocr.module';
import { TasksModule } from '@/tasks/tasks.module';
import { JobsModule } from '@/jobs/jobs.module';
import { DocumentsModule } from '@/documents/documents.module';
import { MattersModule } from '@/matters/matters.module';
import { TimelineModule } from '@/timeline/timeline.module';
import { UsersModule } from '@/users/users.module';
import { DraftIntentModule } from './draft-intent/draft-intent.module';
import { MatterIntelligencePlatformModule } from './matter-intelligence/matter-intelligence.module';
import { AiCommandCenterService } from './ai-command-center.service';
import { ReActAgentService } from './react-agent.service';
import { OutcomePredictorService } from './ml/outcome-predictor.service';
import { BillingRecoveryService } from './ml/billing-recovery.service';
import { LeadScoringService } from './ml/lead-scoring.service';
import { AiComplianceGuardService } from './ai-compliance-guard.service';
import { AiController } from './ai.controller';
import { AiGatewayService } from './ai-gateway.service';
import { AiPolicyService } from './ai-policy.service';
import { AiUsageService } from './ai-usage.service';
import { CitationVerificationService } from './citations/citation-verification.service';
import { CitationAppendixBuilderService } from './citations/citation-appendix-builder.service';
import { SubstanceVerificationService } from './citations/substance-verification.service';
import { AiCostService } from './costs/ai-cost.service';
import { ModelCostSyncService } from './costs/model-cost-sync.service';
import { AiCycleMarginGuardService } from './costs/ai-cycle-margin-guard.service';
import { AiUsageRecorderService } from './ai-usage-recorder.service';
import { CopilotController } from './copilot.controller';
import { CopilotService } from './copilot.service';
import { LlmCompletionService } from './llm-completion.service';
import { ModelRouterService } from './model-router/model-router.service';
import { AiPromptTemplateService } from './prompts/ai-prompt-template.service';
import { ProactiveCopilotService } from './proactive-copilot.service';
import { CopilotPlanService } from './copilot-plan.service';
import { CopilotPlanController } from './copilot-plan.controller';
import { LegalCitationVerifierService } from './legal-research/legal-citation-verifier.service';
import { LegalResearchClassifierService } from './legal-research/legal-research-classifier.service';
import { LegalResearchModelRouter } from './legal-research/legal-research-model-router.service';
import { AuthorityTripleCheckService } from './legal-research/authority-triple-check.service';
import { LegalResearchComplexityScorer } from './legal-research/legal-research-complexity-scorer.service';
import { LegalResearchLlmVerifierService } from './legal-research/legal-research-llm-verifier.service';
import { ResearchPolicyService } from './legal-research/research-policy.service';
import { GapQueryBuilderService } from './legal-research/gap-query-builder.service';
import { LegalSanityCheckService } from './legal-research/legal-sanity-check.service';
import { CurrentLawCheckerService } from './legal-research/current-law-checker.service';
import { StatuteVersionCheckerService } from './legal-research/statute-version-checker.service';
import { FirExtractionService } from './fir/fir-extraction.service';
import { AuthorityRegistryService } from './legal-research/authority-registry.service';
import { SimilarCasesService } from './legal-research/similar-cases.service';
import { SectionMismatchService } from './legal-research/section-mismatch.service';
import { ResearchCorrectionService } from './legal-research/research-correction.service';
import { ResearchSectionFinderGroundingService } from './legal-research/research-section-finder-grounding.service';
import { ResearchEnrichService } from './legal-research/research-enrich.service';
import { ManualCitationReviewService } from './legal-research/manual-citation-review.service';
import { SavedResearchService } from './legal-research/saved-research.service';
import { ResearchCachePromotionService } from './legal-research/research-cache-promotion.service';
import { BailSectionResolverService } from './bail-section-resolver.service';
import { LegalSectionRouterService } from './legal-section-router.service';
import { IndiaDraftController } from './india-draft/india-draft.controller';
import { IndiaDraftService } from './india-draft/india-draft.service';
import { IndiaDraftGroundingService } from './india-draft/india-draft-grounding.service';
import { IndiaDraftVerificationService } from './india-draft/india-draft-verification.service';
import { ExtractFormFieldsService } from './india-draft/extract-form-fields.service';
import { DraftVerificationService } from './drafting/draft-verification.service';
import { DraftProceduralGateService } from './drafting/draft-procedural-gate.service';
import { DraftProceduralRouterService } from './drafting/draft-procedural-router.service';
import { DraftResearchGroundingService } from './drafting/draft-research-grounding.service';
import { DraftingIntelligenceMapService } from './drafting/drafting-intelligence-map.service';
import { DraftPreChecklistService } from './drafting/draft-pre-checklist.service';
import { DraftAccuracyGateService } from './drafting/draft-accuracy-gate.service';
import { DraftSectionFinderGroundingService } from './drafting/draft-section-finder-grounding.service';
import { DraftArchetypeRouterService } from './drafting/archetypes/draft-archetype-router.service';
import { DraftLegalRegisterService } from './drafting/draft-legal-register.service';
import { DraftFactFidelityService } from './drafting/draft-fact-fidelity.service';
import { DraftCaseBriefService } from './drafting/draft-case-brief.service';
import { DraftProceduralTimelineValidator } from './drafting/draft-procedural-timeline.validator';
import { DraftCaseFactCoverageService } from './drafting/draft-case-fact-coverage.service';
import { DraftKindPlaybookService } from './drafting/playbooks/draft-kind-playbook.service';
import { DraftPleadingReviewService } from './drafting/draft-pleading-review.service';
import { DraftAmendmentApplierService } from './drafting/draft-amendment-applier.service';
import { DraftIntakeExtractionService } from './drafting/draft-intake-extraction.service';
import { UnifiedVerificationService } from './verification/unified-verification.service';
import { AuthorityIdentityService } from './verification/authority-identity.service';
import { CitationResolutionService } from './verification/citation-resolution.service';
import { QuotationVerificationService } from './verification/quotation-verification.service';
import { PropositionExtractionService } from './verification/proposition-extraction.service';
import { ClaimRepairService } from './verification/claim-repair.service';
import { ClaimLevelVerificationService } from './legal-research/claim-level-verification.service';
import { LegalEvidencePackService } from './legal-research/legal-evidence-pack.service';
import { LegalEvidenceSufficiencyService } from './legal-research/legal-evidence-sufficiency.service';
import { StructuredResearchSynthesisService } from './legal-research/structured-research-synthesis.service';
import { IkEvidenceIngestService } from './legal-research/ik-evidence-ingest.service';
import { KeEvidenceIngestService } from './legal-research/ke-evidence-ingest.service';
import { CaseCandidateDiscoveryService } from './legal-research/case-candidate-discovery.service';
import { CaseLawRecoveryService } from './legal-research/case-law-recovery.service';
import { AgenticResearchLoopService } from './legal-research/agentic-research-loop.service';
import { ResearchLearningService } from './legal-research/research-learning.service';
import { ResearchIntelligenceMapService } from './legal-research/research-intelligence-map.service';
import { AuthorityCandidateResolverService } from './legal-research/authority-candidate-resolver.service';
import { IndiaKanoonQueryBuilderService } from './legal-research/india-kanoon-query-builder.service';
import { KenyaLawQueryBuilderService } from './legal-research/kenya-law-query-builder.service';
import { KenyaDraftGroundingService } from './kenya-draft/kenya-draft-grounding.service';
import { CourtHierarchyResolverService } from './legal-research/court-hierarchy-resolver.service';
import { PropositionEntailmentService } from './verification/proposition-entailment.service';
import { CourtHierarchyService } from './verification/court-hierarchy.service';
import { TreatmentGraphService } from './verification/treatment-graph.service';
import { RelevanceVerificationService } from './verification/relevance-verification.service';
import { DraftPropositionPlanService } from './drafting/draft-proposition-plan.service';
import { DraftCaseTheoryService } from './drafting/draft-case-theory.service';
import { DraftArgumentGraphService } from './drafting/draft-argument-graph.service';
import { DraftCoherenceReviewService } from './drafting/draft-coherence-review.service';
import { AuthorityConflictDetectorService } from './legal-research/authority-conflict-detector.service';
import { CourtDraftHistoryService } from './drafting/court-draft-history.service';
import { HumanReviewService } from './drafting/platform/human-review.service';
import { DraftFilingReleaseService } from './drafting/platform/draft-filing-release.service';
import { DocumentRecommendationService } from './recommendations/document-recommendation.service';
import { DocumentRecommendationsController } from './recommendations/document-recommendations.controller';
import { CaseLawCoverageService } from './legal-research/case-law-coverage.service';
import { ResearchApplicationService } from './legal-research/research-application.service';
import { CourtDraftController } from './drafting/court-draft.controller';
import { UsDraftController } from './us-draft/us-draft.controller';
import { UsDraftService } from './us-draft/us-draft.service';
import { UsLegalSectionRouterService } from './us-draft/us-legal-section-router.service';
import { TabularReviewService } from './tabular-review.service';
import { AiModelEnvAuditService } from './ai-model-env-audit.service';
import { DraftStructuralReferenceService } from './drafting/structural-references/reference-skeleton.service';
import { DraftStructureAuditService } from './drafting/draft-structure-audit.service';
import { DocumentIngestService } from '@/drafting-session/document-ingest.service';
// Drafting Engine v2 services
import { DraftEngineV2Service } from './drafting-v2/draft-engine-v2.service';
import { PlanningEngineService } from './drafting-v2/planning-engine.service';
import { OutlineBuilderService } from './drafting-v2/outline-builder.service';
import { SectionGeneratorService } from './drafting-v2/section-generator.service';
import { ConfidenceEngineService } from './drafting-v2/confidence-engine.service';
import { SectionVerifierService } from './drafting-v2/section-verifier.service';
import { TargetedRepairService } from './drafting-v2/targeted-repair.service';
import { EvidenceValidationService } from './drafting-v2/evidence-validation.service';
import { FinalAssemblyService } from './drafting-v2/final-assembly.service';
import { RuleEngineService } from './drafting-v2/rule-engine/rule-engine.service';
import { LimitationEngineService } from './drafting-v2/rule-engine/limitation-engine.service';
import { CourtFeeCalculatorService } from './drafting-v2/rule-engine/court-fee-calculator.service';
import { StampDutyCalculatorService } from './drafting-v2/rule-engine/stamp-duty-calculator.service';
import { ForumJurisdictionResolverService } from './drafting-v2/rule-engine/forum-jurisdiction-resolver.service';
import { MandatoryAnnexureResolverService } from './drafting-v2/rule-engine/mandatory-annexure-resolver.service';
import { LegalGraphService } from './drafting-v2/legal-graph/legal-graph.service';
import { DraftingV2MetricsService } from './drafting-v2/drafting-v2-metrics.service';
import { DraftingV2ShadowService } from './drafting-v2/drafting-v2-shadow.service';
import { DraftComplexityService } from './drafting-v2/draft-complexity.service';
import { ModelRegistryService } from './model-registry/model-registry.service';
import { UnifiedDraftingModule } from './unified-drafting/unified-drafting.module';
import { DraftFeedbackModule } from './feedback/draft-feedback.module';
import { PromptLibraryModule } from './prompt-library/prompt-library.module';
import { PromptRefinementModule } from './prompt-refinement/prompt-refinement.module';
import { MatterResearchContextService } from './legal-research/matter-research-context.service';
import { ProcessingDisclosureController } from './processing-disclosure.controller';
import { ResearchRequestNormalizerService } from './legal-research/research-request-normalizer.service';
import { ResearchTaskRouterService } from './legal-research/research-task-router.service';
import { ResearchCapabilityService } from './legal-research/research-capability.service';
import { ResearchPlanService } from './legal-research/research-plan.service';
import { FactLedgerService } from './legal-research/fact-ledger.service';
import { EvidenceConfidenceService } from './legal-research/evidence-confidence.service';
import { PropositionGraphValidatorService } from './legal-research/proposition-graph-validator.service';
import { ResearchPublicationDecisionService } from './legal-research/research-publication-decision.service';
import { FeatureFlagsModule } from '@/platform/feature-flags/feature-flags.module';
import { SmartWorkspaceModule } from '@/smart-workspace/smart-workspace.module';
import { LegalLocationModule } from '@/legal-location/legal-location.module';

@Module({
  imports: [
    AgentsModule,
    AiCreditsModule,
    AuditModule,
    ClientsModule,
    forwardRef(() => CreditsModule),
    CountryComplianceModule,
    LegalComplianceModule,
    LegalSourcesModule,
    LegalSearchModule,
    FirmMemoryModule,
    LegalLocationModule,
    OcrModule,
    MulterModule.register({ dest: '/tmp' }),
    TasksModule,
    JobsModule,
    forwardRef(() => DocumentsModule),
    forwardRef(() => MattersModule),
    TimelineModule,
    UsersModule,
    MatterIntelligencePlatformModule,
    DraftIntentModule,
    UnifiedDraftingModule,
    DraftFeedbackModule,
    PromptLibraryModule,
    PromptRefinementModule,
    FeatureFlagsModule,
    SmartWorkspaceModule,
  ],
  controllers: [
    ProcessingDisclosureController,
    AiController,
    CopilotController,
    CopilotPlanController,
    IndiaDraftController,
    UsDraftController,
    CourtDraftController,
    DocumentRecommendationsController,
  ],
  providers: [
    AiGatewayService,
    MatterResearchContextService,
    AiPolicyService,
    AiUsageService,
    AiComplianceGuardService,
    AiCommandCenterService,
    CopilotService,
    LlmCompletionService,
    ModelRouterService,
    AiCostService,
    ModelCostSyncService,
    AiCycleMarginGuardService,
    AiUsageRecorderService,
    CitationVerificationService,
    CitationAppendixBuilderService,
    SubstanceVerificationService,
    AiPromptTemplateService,
    ProactiveCopilotService,
    CopilotPlanService,
    ReActAgentService,
    LegalResearchVerificationService,
    DeepResearchAgentService,
    OutcomePredictorService,
    BillingRecoveryService,
    LeadScoringService,
    LegalCitationVerifierService,
    LegalResearchClassifierService,
    ResearchRequestNormalizerService,
    ResearchTaskRouterService,
    ResearchCapabilityService,
    ResearchPlanService,
    FactLedgerService,
    EvidenceConfidenceService,
    PropositionGraphValidatorService,
    ResearchPublicationDecisionService,
    LegalResearchModelRouter,
    AuthorityTripleCheckService,
    LegalResearchComplexityScorer,
    LegalResearchLlmVerifierService,
    ResearchPolicyService,
    GapQueryBuilderService,
    IndiaKanoonQueryBuilderService,
    KenyaLawQueryBuilderService,
    LegalSanityCheckService,
    CurrentLawCheckerService,
    StatuteVersionCheckerService,
    AuthorityRegistryService,
    SimilarCasesService,
    FirExtractionService,
    SectionMismatchService,
    ResearchCorrectionService,
    ResearchSectionFinderGroundingService,
    ResearchEnrichService,
    ManualCitationReviewService,
    SavedResearchService,
    ResearchCachePromotionService,
    BailSectionResolverService,
    LegalSectionRouterService,
    DraftVerificationService,
    DraftProceduralGateService,
    DraftProceduralRouterService,
    DraftResearchGroundingService,
    DraftingIntelligenceMapService,
    DraftPreChecklistService,
    DraftAccuracyGateService,
    DraftSectionFinderGroundingService,
    DraftArchetypeRouterService,
    DraftLegalRegisterService,
    DraftFactFidelityService,
    DraftCaseBriefService,
    DraftProceduralTimelineValidator,
    DraftCaseFactCoverageService,
    DraftKindPlaybookService,
    DraftPleadingReviewService,
    DraftAmendmentApplierService,
    DraftIntakeExtractionService,
    UsLegalSectionRouterService,
    UnifiedVerificationService,
    AuthorityIdentityService,
    CitationResolutionService,
    QuotationVerificationService,
    PropositionExtractionService,
    ClaimRepairService,
    ClaimLevelVerificationService,
    LegalEvidencePackService,
    LegalEvidenceSufficiencyService,
    StructuredResearchSynthesisService,
    IkEvidenceIngestService,
    KeEvidenceIngestService,
    CaseCandidateDiscoveryService,
    CaseLawRecoveryService,
    AgenticResearchLoopService,
    ResearchLearningService,
    ResearchIntelligenceMapService,
    AuthorityCandidateResolverService,
    IndiaKanoonQueryBuilderService,
    CourtHierarchyResolverService,
    PropositionEntailmentService,
    CourtHierarchyService,
    TreatmentGraphService,
    RelevanceVerificationService,
    DraftPropositionPlanService,
    DraftCaseTheoryService,
    DraftArgumentGraphService,
    DraftCoherenceReviewService,
    AuthorityConflictDetectorService,
    CourtDraftHistoryService,
    HumanReviewService,
    DraftFilingReleaseService,
    DocumentRecommendationService,
    CaseLawCoverageService,
    ResearchApplicationService,
    IndiaDraftGroundingService,
    KenyaDraftGroundingService,
    IndiaDraftVerificationService,
    ExtractFormFieldsService,
    IndiaDraftService,
    UsDraftService,
    TabularReviewService,
    AiModelEnvAuditService,
    DraftStructuralReferenceService,
    DraftStructureAuditService,
    DocumentIngestService,
    // ── Drafting Engine v2 ────────────────────────────────────────────────────
    PlanningEngineService,
    LegalGraphService,
    LimitationEngineService,
    CourtFeeCalculatorService,
    StampDutyCalculatorService,
    ForumJurisdictionResolverService,
    MandatoryAnnexureResolverService,
    RuleEngineService,
    OutlineBuilderService,
    EvidenceValidationService,
    SectionGeneratorService,
    ConfidenceEngineService,
    SectionVerifierService,
    TargetedRepairService,
    FinalAssemblyService,
    DraftingV2MetricsService,
    DraftingV2ShadowService,
    DraftEngineV2Service,
    DraftComplexityService,
    ModelRegistryService,
  ],
  exports: [
    AiGatewayService,
    AiPolicyService,
    AiUsageService,
    AiComplianceGuardService,
    AiCommandCenterService,
    CopilotService,
    LlmCompletionService,
    ProactiveCopilotService,
    CopilotPlanService,
    FirExtractionService,
    ModelRouterService,
    AiCostService,
    ModelCostSyncService,
    AiCycleMarginGuardService,
    AiUsageRecorderService,
    ReActAgentService,
    LegalSectionRouterService,
    CitationVerificationService,
    CitationAppendixBuilderService,
    SubstanceVerificationService,
    LegalSearchModule,
    LegalResearchVerificationService,
    LegalResearchLlmVerifierService,
    ResearchRequestNormalizerService,
    ResearchTaskRouterService,
    ResearchCapabilityService,
    ResearchPlanService,
    AuthorityIdentityService,
    CitationResolutionService,
    QuotationVerificationService,
    PropositionExtractionService,
    ClaimRepairService,
    ClaimLevelVerificationService,
    LegalEvidencePackService,
    StructuredResearchSynthesisService,
    IkEvidenceIngestService,
    KeEvidenceIngestService,
    KenyaLawQueryBuilderService,
    CaseCandidateDiscoveryService,
    CaseLawRecoveryService,
    AgenticResearchLoopService,
    ResearchLearningService,
    ResearchIntelligenceMapService,
    AuthorityCandidateResolverService,
    IndiaKanoonQueryBuilderService,
    CourtHierarchyResolverService,
    PropositionEntailmentService,
    CourtHierarchyService,
    TreatmentGraphService,
    RelevanceVerificationService,
    DraftPropositionPlanService,
    DeepResearchAgentService,
    OutcomePredictorService,
    BillingRecoveryService,
    LeadScoringService,
    LegalCitationVerifierService,
    LegalResearchClassifierService,
    LegalSanityCheckService,
    CurrentLawCheckerService,
    StatuteVersionCheckerService,
    AuthorityRegistryService,
    SimilarCasesService,
    TabularReviewService,
    AiModelEnvAuditService,
    MatterIntelligencePlatformModule,
    ModelRegistryService,
    DraftFeedbackModule,
    UnifiedDraftingModule,
  ],
})
export class AiModule {}
