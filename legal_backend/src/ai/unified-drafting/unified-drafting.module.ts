import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '@/prisma/prisma.module';
import { LegalSearchModule } from '@/legal-search/legal-search.module';
import { LegalSourcesModule } from '@/legal-sources/legal-sources.module';
import { DraftFeedbackModule } from '@/ai/feedback/draft-feedback.module';

// Controllers
import { DraftJobsController } from './draft-jobs.controller';

// Core services
import { DraftJobService } from './draft-job.service';
import { DraftJobDispatchReconcilerService } from './draft-job-dispatch-reconciler.service';
import { DraftWorkerProcessor } from './draft-worker.processor';
import { DraftModelRouterService } from './draft-model-router.service';

// Progress
import { DraftProgressService } from './progress/draft-progress.service';

// Stage services
import { MatterNormalizationService } from './intake/matter-normalization.service';
import { RequiredInputResolverService } from './intake/required-input-resolver.service';
import { UnifiedProceduralGateService } from './procedural/unified-procedural-gate.service';
import { DraftRetrievalCoordinator } from './retrieval/draft-retrieval-coordinator.service';
import { VerifiedSourceRegistryService } from './retrieval/verified-source-registry.service';
import { DraftPlanningService } from './planning/draft-planning.service';
import { UnifiedSectionGenerationService } from './generation/unified-section-generation.service';
import { UnifiedDraftVerificationService } from './verification/unified-draft-verification.service';
import { DraftDefectReportService } from './verification/draft-defect-report.service';
import { UnifiedTargetedRepairService } from './repair/unified-targeted-repair.service';
import { DraftAssemblyService } from './assembly/draft-assembly.service';
import { CaseLawEnrichService } from './enrich/case-law-enrich.service';
import { LawyerReadyPipelineService } from './verification/lawyer-ready-pipeline.service';
import { DraftCaseBriefService } from '@/ai/drafting/draft-case-brief.service';
import { DraftCaseTheoryService } from '@/ai/drafting/draft-case-theory.service';
import { DraftArgumentGraphService } from '@/ai/drafting/draft-argument-graph.service';
import { DraftCoherenceReviewService } from '@/ai/drafting/draft-coherence-review.service';
import { DraftProceduralTimelineValidator } from '@/ai/drafting/draft-procedural-timeline.validator';
import { DraftCaseFactCoverageService } from '@/ai/drafting/draft-case-fact-coverage.service';
import { DraftKindPlaybookService } from '@/ai/drafting/playbooks/draft-kind-playbook.service';
import { DraftPleadingReviewService } from '@/ai/drafting/draft-pleading-review.service';
import { DraftAmendmentApplierService } from '@/ai/drafting/draft-amendment-applier.service';
import { DraftAccuracyGateService } from '@/ai/drafting/draft-accuracy-gate.service';

// Platform accuracy (shared core, bail-first)
import { CaseRecordExtractionService } from '@/ai/drafting/platform/case-record-extraction.service';
import { SourceConflictResolver } from '@/ai/drafting/platform/source-conflict-resolver.service';
import { DraftPlaybookRegistryService } from '@/ai/drafting/platform/draft-playbook-registry.service';
import { DocumentKindResolver } from '@/ai/drafting/platform/document-kind-resolver.service';
import { IssuePlanService } from '@/ai/drafting/platform/issue-plan.service';
import { StructuredDraftGenerator } from '@/ai/drafting/platform/structured-draft-generator.service';
import { UniversalReleaseGateService } from '@/ai/drafting/platform/universal-release-gate.service';
import { DraftPipelineService } from '@/ai/drafting/platform/draft-pipeline.service';
import { HumanReviewService } from '@/ai/drafting/platform/human-review.service';
import { DraftAccuracyMetricsService } from '@/ai/drafting/platform/draft-accuracy-metrics.service';
import { BailFactMaterialityService } from '@/ai/drafting/platform/adapters/bail-fact-materiality.service';
import { RegularBailAdapter } from '@/ai/drafting/platform/adapters/regular-bail.adapter';
import { AnticipatoryBailAdapter } from '@/ai/drafting/platform/adapters/anticipatory-bail.adapter';
import { LegalNoticeAdapter } from '@/ai/drafting/platform/adapters/legal-notice.adapter';
import { ContractDraftAdapter } from '@/ai/drafting/platform/adapters/contract-draft.adapter';
import { ResearchMemoAdapter } from '@/ai/drafting/platform/adapters/research-memo.adapter';
import { ConsumerComplaintAdapter } from '@/ai/drafting/platform/adapters/consumer-complaint.adapter';
import { GenericDraftAdapter } from '@/ai/drafting/platform/adapters/generic-draft.adapter';
import { TimelineDeterministicRuleEngine } from '@/ai/drafting/platform/validators/timeline-deterministic-rule-engine';
import { TimelineSemanticContradictionAuditor } from '@/ai/drafting/platform/validators/timeline-semantic-contradiction-auditor';
import { PartyRoleConsistencyValidator } from '@/ai/drafting/platform/validators/party-role-consistency.validator';
import { AtomicEntailmentAuditor } from '@/ai/drafting/platform/validators/atomic-entailment-auditor';
import { DraftLeakSanitizer } from '@/ai/drafting/platform/validators/draft-leak-sanitizer.service';
import { StatuteExistenceVerifier } from '@/ai/drafting/platform/validators/statute-existence-verifier';
import { AuthorityVerificationGateValidator } from '@/ai/drafting/platform/validators/authority-verification-gate.validator';
import { PartyEntityValidatorService } from '@/ai/drafting/accuracy/party-entity-validator.service';
import { KnownFactPlaceholderValidatorService } from '@/ai/drafting/accuracy/known-fact-placeholder-validator.service';
import { FactFidelityAuditorService } from '@/ai/drafting/accuracy/fact-fidelity-auditor.service';
import { StatuteSectionValidatorService } from '@/ai/drafting/accuracy/statute-section-validator.service';
import { JurisdictionValidatorService } from '@/ai/drafting/accuracy/jurisdiction-validator.service';
import { PleadingCompletenessValidatorService } from '@/ai/drafting/accuracy/pleading-completeness-validator.service';
import { LimitationCauseOfActionValidatorService } from '@/ai/drafting/accuracy/limitation-cause-of-action-validator.service';
import { AdverseMaterialValidatorService } from '@/ai/drafting/accuracy/adverse-material-validator.service';
import { ReliefTestValidatorService } from '@/ai/drafting/accuracy/relief-test-validator.service';
import { CourtLanguageValidatorService } from '@/ai/drafting/accuracy/court-language-validator.service';
import { DraftAccuracyOrchestratorService } from '@/ai/drafting/accuracy/draft-accuracy-orchestrator.service';
import { DraftProvenanceService } from '@/ai/drafting/accuracy/draft-provenance.service';
import { DraftAccuracyRepairService } from '@/ai/drafting/accuracy/draft-accuracy-repair.service';
import { DraftRepairSourceResolverService } from '@/ai/drafting/accuracy/draft-repair-source-resolver.service';
import { DraftRepairConfirmationService } from '@/ai/drafting/accuracy/draft-repair-confirmation.service';
import { ValuationCourtFeeValidatorService } from '@/ai/drafting/accuracy/valuation-court-fee-validator.service';
import { AnnexureEvidenceValidatorService } from '@/ai/drafting/accuracy/annexure-evidence-validator.service';
import { CitationPropositionValidatorService } from '@/ai/drafting/accuracy/citation-proposition-validator.service';
import { LiabilityConsentExpertValidatorsService } from '@/ai/drafting/accuracy/liability-consent-expert-validators.service';
import { ResearchMemoQualityValidatorService } from '@/ai/drafting/accuracy/research-memo-quality.validator';
import { AuthorityRetrievalPlannerService } from '@/ai/drafting/platform/authority-retrieval-planner.service';
import { PropositionEntailmentService } from '@/ai/verification/proposition-entailment.service';
import { AuthorityIdentityService } from '@/ai/verification/authority-identity.service';
import { QuotationVerificationService } from '@/ai/verification/quotation-verification.service';
import { CourtHierarchyService } from '@/ai/verification/court-hierarchy.service';
import { CourtHierarchyResolverService } from '@/ai/legal-research/court-hierarchy-resolver.service';
import { TreatmentGraphService } from '@/ai/verification/treatment-graph.service';
import { CurrentLawCheckerService } from '@/ai/legal-research/current-law-checker.service';
import { AuthorityEnrichVerifier } from './enrich/authority-enrich-verifier';
import { DraftAuthorityVerificationService } from './verification/draft-authority-verification.service';
import { DraftStructuralReferenceService } from '@/ai/drafting/structural-references/reference-skeleton.service';
import { CourtDraftHistoryService } from '@/ai/drafting/court-draft-history.service';

// Adapters
import { IndiaDraftAdapter } from './adapters/india-draft.adapter';
import { WorkspaceV3Adapter } from './adapters/workspace-v3.adapter';

// Shared
import { BailSectionResolverService } from '@/ai/bail-section-resolver.service';
import { LegalSectionRouterService } from '@/ai/legal-section-router.service';
import { SimilarCasesService } from '@/ai/legal-research/similar-cases.service';
import { ResearchSectionFinderGroundingService } from '@/ai/legal-research/research-section-finder-grounding.service';
import { IkEvidenceIngestService } from '@/ai/legal-research/ik-evidence-ingest.service';
import { IndiaKanoonQueryBuilderService } from '@/ai/legal-research/india-kanoon-query-builder.service';
import { LegalEvidencePackService } from '@/ai/legal-research/legal-evidence-pack.service';

// LlmCompletionService is provided by the parent AiModule and forwarded down.
// LegalRetrievalOrchestrator comes from LegalSearchModule.
import { LlmCompletionService } from '@/ai/llm-completion.service';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    LegalSearchModule, // provides + exports LegalRetrievalOrchestrator
    LegalSourcesModule, // India Kanoon connector for draft enrich
    DraftFeedbackModule, // draft corrections → prompt injection learning loop
  ],
  controllers: [DraftJobsController],
  providers: [
    // Core
    DraftJobService,
    DraftJobDispatchReconcilerService,
    CourtDraftHistoryService,
    DraftWorkerProcessor,
    DraftModelRouterService,
    DraftProgressService,

    // Stages
    MatterNormalizationService,
    RequiredInputResolverService,
    UnifiedProceduralGateService,
    DraftRetrievalCoordinator,
    VerifiedSourceRegistryService,
    DraftPlanningService,
    UnifiedSectionGenerationService,
    DraftStructuralReferenceService,
    UnifiedDraftVerificationService,
    DraftDefectReportService,
    UnifiedTargetedRepairService,
    DraftAssemblyService,
    CaseLawEnrichService,
    LawyerReadyPipelineService,
    DraftCaseBriefService,
    DraftCaseTheoryService,
    DraftArgumentGraphService,
    DraftCoherenceReviewService,
    DraftProceduralTimelineValidator,
    DraftCaseFactCoverageService,
    DraftKindPlaybookService,
    DraftPleadingReviewService,
    DraftAmendmentApplierService,
    DraftAccuracyGateService,
    SimilarCasesService,
    ResearchSectionFinderGroundingService,
    LegalEvidencePackService,
    IndiaKanoonQueryBuilderService,
    IkEvidenceIngestService,

    // Platform accuracy
    DraftAccuracyMetricsService,
    CaseRecordExtractionService,
    SourceConflictResolver,
    DraftPlaybookRegistryService,
    BailFactMaterialityService,
    RegularBailAdapter,
    AnticipatoryBailAdapter,
    LegalNoticeAdapter,
    ContractDraftAdapter,
    ResearchMemoAdapter,
    ConsumerComplaintAdapter,
    GenericDraftAdapter,
    DocumentKindResolver,
    IssuePlanService,
    StructuredDraftGenerator,
    TimelineDeterministicRuleEngine,
    TimelineSemanticContradictionAuditor,
    PartyRoleConsistencyValidator,
    AtomicEntailmentAuditor,
    DraftLeakSanitizer,
    StatuteExistenceVerifier,
    AuthorityVerificationGateValidator,
    AuthorityRetrievalPlannerService,
    PropositionEntailmentService,
    AuthorityIdentityService,
    QuotationVerificationService,
    CourtHierarchyResolverService,
    CourtHierarchyService,
    TreatmentGraphService,
    CurrentLawCheckerService,
    AuthorityEnrichVerifier,
    DraftAuthorityVerificationService,
    PartyEntityValidatorService,
    KnownFactPlaceholderValidatorService,
    FactFidelityAuditorService,
    StatuteSectionValidatorService,
    JurisdictionValidatorService,
    PleadingCompletenessValidatorService,
    LimitationCauseOfActionValidatorService,
    AdverseMaterialValidatorService,
    ReliefTestValidatorService,
    CourtLanguageValidatorService,
    ValuationCourtFeeValidatorService,
    AnnexureEvidenceValidatorService,
    CitationPropositionValidatorService,
    LiabilityConsentExpertValidatorsService,
    ResearchMemoQualityValidatorService,
    DraftAccuracyRepairService,
    DraftRepairSourceResolverService,
    DraftRepairConfirmationService,
    DraftAccuracyOrchestratorService,
    DraftProvenanceService,
    UniversalReleaseGateService,
    HumanReviewService,
    DraftPipelineService,

    // Adapters
    IndiaDraftAdapter,
    WorkspaceV3Adapter,

    // Shared
    BailSectionResolverService,
    LegalSectionRouterService,

    // LlmCompletionService must be re-listed here so it is available in this
    // module scope. NestJS deduplicates at the instance level — this does not
    // create a second connection or client.
    LlmCompletionService,
  ],
  exports: [
    DraftJobService,
    DraftProgressService,
    IndiaDraftAdapter,
    WorkspaceV3Adapter,
    DraftModelRouterService,
    BailSectionResolverService,
    LegalSectionRouterService,
    CaseLawEnrichService,
    DraftPipelineService,
    DraftPlaybookRegistryService,
    CaseRecordExtractionService,
    UniversalReleaseGateService,
    HumanReviewService,
    DraftAccuracyMetricsService,
    DraftAccuracyOrchestratorService,
    DraftProvenanceService,
    DraftAuthorityVerificationService,
    DraftAccuracyRepairService,
    DraftRepairSourceResolverService,
    DraftRepairConfirmationService,
    CaseRecordExtractionService,
  ],
})
export class UnifiedDraftingModule {}
