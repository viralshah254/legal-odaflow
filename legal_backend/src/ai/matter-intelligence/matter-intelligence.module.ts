import { Module, forwardRef } from '@nestjs/common';
import { LegalFormsModule } from '@/legal-forms/legal-forms.module';
import { EmbeddingsModule } from '@/embeddings/embeddings.module';
import { AiModule } from '@/ai/ai.module';
import { MatterIntelligenceService } from './matter-intelligence.service';
import { MatterGraphExtractorService } from './matter-graph-extractor.service';
import { MatterTaskGraphService } from './matter-task-graph.service';
import { ConfidenceGateService } from './confidence-gate.service';
import { DocumentDependencyService } from './document-dependency.service';
import { LegalAssetRetrievalService } from './legal-asset-retrieval.service';
import { ActionRecommendationService } from './action-recommendation.service';
import { MatterMemoryService } from './matter-memory.service';
import { SelectionTrackingService } from './selection-tracking.service';
import { MatterIntelligencePipelineService } from './matter-intelligence-pipeline.service';
import { OutcomeProfileService } from './outcome-profile.service';
import { EvidenceExtractorService } from './evidence-extractor.service';
import { EvidenceAnalysisService } from './evidence-analysis.service';
import { MiAuditLogService } from './mi-audit-log.service';
import { DocumentReviewMiService } from './document-review-mi.service';
import { MiObservabilityService } from './mi-observability.service';
import { MiShadowModeService } from './mi-shadow-mode.service';
import { MiReviewService } from './mi-review.service';
import { MiAuthorityRankerService } from './mi-authority-ranker.service';

@Module({
  imports: [LegalFormsModule, EmbeddingsModule, forwardRef(() => AiModule)],
  providers: [
    MatterIntelligenceService,
    MatterGraphExtractorService,
    MatterTaskGraphService,
    ConfidenceGateService,
    DocumentDependencyService,
    LegalAssetRetrievalService,
    ActionRecommendationService,
    MatterMemoryService,
    SelectionTrackingService,
    MatterIntelligencePipelineService,
    OutcomeProfileService,
    EvidenceExtractorService,
    EvidenceAnalysisService,
    MiAuditLogService,
    MiObservabilityService,
    MiShadowModeService,
    DocumentReviewMiService,
    MiReviewService,
    MiAuthorityRankerService,
  ],
  exports: [
    MatterIntelligenceService,
    MatterGraphExtractorService,
    MatterTaskGraphService,
    ConfidenceGateService,
    DocumentDependencyService,
    LegalAssetRetrievalService,
    ActionRecommendationService,
    MatterMemoryService,
    SelectionTrackingService,
    MatterIntelligencePipelineService,
    OutcomeProfileService,
    EvidenceExtractorService,
    EvidenceAnalysisService,
    MiAuditLogService,
    MiObservabilityService,
    MiShadowModeService,
    DocumentReviewMiService,
    MiReviewService,
    MiAuthorityRankerService,
  ],
})
export class MatterIntelligencePlatformModule {}
