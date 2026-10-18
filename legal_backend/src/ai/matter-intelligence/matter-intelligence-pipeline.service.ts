import { Injectable } from '@nestjs/common';
import { MatterIntelligenceService } from './matter-intelligence.service';
import { MatterGraphExtractorService } from './matter-graph-extractor.service';
import { MatterTaskGraphService } from './matter-task-graph.service';
import { LegalAssetRetrievalService } from './legal-asset-retrieval.service';
import { ActionRecommendationService } from './action-recommendation.service';
import { DocumentDependencyService } from './document-dependency.service';
import { MiObservabilityService } from './mi-observability.service';
import { MiShadowModeService } from './mi-shadow-mode.service';
import { MiAuditLogService } from './mi-audit-log.service';
import { MiReviewService } from './mi-review.service';
import { isMiEnabled, MI_FEATURE_FLAGS } from './mi-feature-flags';
import type {
  MatterClassificationResult,
  MatterIntelligenceInput,
} from './matter-intelligence.types';
import type { RecommendedAction } from './action-recommendation.service';
import type { RetrievedAsset } from './legal-asset-retrieval.service';

export interface MatterIntelligencePipelineResult extends MatterClassificationResult {
  actions?: RecommendedAction[];
  retrievedAssets?: RetrievedAsset[];
  preDraftBlocked?: boolean;
  preDraftMissing?: string[];
}

@Injectable()
export class MatterIntelligencePipelineService {
  constructor(
    private readonly classifier: MatterIntelligenceService,
    private readonly graphExtractor: MatterGraphExtractorService,
    private readonly taskGraphBuilder: MatterTaskGraphService,
    private readonly retrieval: LegalAssetRetrievalService,
    private readonly actions: ActionRecommendationService,
    private readonly documentDependency: DocumentDependencyService,
    private readonly observability: MiObservabilityService,
    private readonly shadowMode: MiShadowModeService,
    private readonly auditLog: MiAuditLogService,
    private readonly miReview: MiReviewService,
  ) {}

  async run(
    input: MatterIntelligenceInput & {
      query?: string;
      countryCode?: string;
      jurisdiction?: string;
      skipRetrieval?: boolean;
      targetDocumentKind?: string;
      consumer?: keyof typeof MI_FEATURE_FLAGS;
    },
  ): Promise<MatterIntelligencePipelineResult> {
    const consumer = input.consumer ?? 'draftIntent';
    if (consumer !== 'shadowMode' && !isMiEnabled(consumer)) {
      const facts = input.facts?.trim() ?? input.query?.trim() ?? '';
      const classification = await this.classifier.classify({
        ...input,
        facts,
        countryCode: input.countryCode,
      });
      return { ...classification, shouldProceed: true };
    }

    const facts = input.facts?.trim() ?? input.query?.trim() ?? '';
    const classifyStarted = Date.now();
    const classification = await this.classifier.classify({
      ...input,
      facts,
      countryCode: input.countryCode,
    });
    this.observability.recordClassify(
      consumer,
      classification.profile,
      Date.now() - classifyStarted,
      classification.recommendationMode,
      !classification.shouldProceed,
    );

    void this.auditLog.recordFromFacts(consumer, facts, classification.profile, {
      tenantId: input.tenantId,
      userId: input.userId,
      entityType: input.entityType,
      entityId: input.entityId,
    });

    void this.miReview.enqueueLowConfidence({
      entityType: input.entityType ?? consumer,
      entityId: input.entityId,
      tenantId: input.tenantId,
      profile: classification.profile,
      recommendationMode: classification.recommendationMode,
    });

    if (MI_FEATURE_FLAGS.shadowMode) {
      this.shadowMode.compareDocumentKind(facts, classification.profile, consumer);
    }

    if (!classification.shouldProceed) {
      return classification;
    }

    const graph = await this.graphExtractor.extract(facts);
    const taskGraph = this.taskGraphBuilder.build(classification.profile, graph);

    const result: MatterIntelligencePipelineResult = {
      ...classification,
      graph,
      taskGraph,
      actions: this.actions.recommend(classification.profile, taskGraph),
    };

    if (input.targetDocumentKind) {
      const required = this.documentDependency.getRequiredDocuments(
        input.targetDocumentKind,
        classification.profile,
      );
      const provided = [
        ...(graph.documents?.map((d) => d.title) ?? []),
        ...(graph.evidence?.map((e) => e.description) ?? []),
      ];
      const gate = this.documentDependency.checkPreDraft(input.targetDocumentKind, provided);
      result.preDraftBlocked = !gate.canProceed;
      result.preDraftMissing = gate.missingInputs.length ? gate.missingInputs : required;
    }

    if (!input.skipRetrieval && facts) {
      const { assets, recommendationMode, topScore } = await this.retrieval.retrieve({
        query: facts,
        profile: classification.profile,
        countryCode: input.countryCode,
        jurisdiction: input.jurisdiction,
      });
      result.retrievedAssets = assets;
      this.observability.recordRetrieval(
        consumer,
        topScore,
        recommendationMode,
        assets.length,
      );
      if (recommendationMode === 'low_confidence' && classification.recommendationMode === 'matched') {
        result.recommendationMode = 'low_confidence';
      }
    }

    return result;
  }
}
