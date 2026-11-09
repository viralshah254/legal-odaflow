import { Injectable, Logger } from '@nestjs/common';
import type { DraftV2Result } from './drafting-v2.types';

export interface DraftV2MetricsSnapshot {
  draftId: string;
  documentKind: string;
  jurisdiction: string;
  engineVersion: 'v2';
  totalSections: number;
  verifiedSections: number;
  needsReviewSections: number;
  repairFailed: number;
  repairTriggered: boolean;
  totalRepairs: number;
  overallConfidenceScore: number;
  overallConfidenceGrade: string;
  citationAccuracyRate: number;
  hallucinationSignals: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  estimatedCostUsd: number;
  latencyMs: number;
  shadowDivergence?: boolean;
}

/**
 * Records structured metrics for every v2 draft generation.
 *
 * Mirrors the MiObservabilityService pattern. All records go to the structured
 * logger and can be aggregated by log drains (Datadog, CloudWatch, etc.).
 *
 * Key metrics tracked per the plan:
 *  - Citation accuracy rate       (verified citations / total citations)
 *  - Repair rate                  (sections repaired / total sections)
 *  - Hallucination signals        (ungrounded claims across all sections)
 *  - Cost per document            (aggregate token cost via model tier)
 *  - Section-level confidence     (per-section breakdown)
 */
@Injectable()
export class DraftingV2MetricsService {
  private readonly logger = new Logger(DraftingV2MetricsService.name);

  recordGeneration(
    result: DraftV2Result,
    meta: {
      draftId: string;
      documentKind: string;
      jurisdiction: string;
      latencyMs: number;
      estimatedCostUsd?: number;
      shadowDivergence?: boolean;
    },
  ): void {
    const { confidenceReport, verificationReport, sections } = result;

    // Count citations across all sections
    let totalCitations = 0;
    let verifiedCitations = 0;
    let hallucinationSignals = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalRepairs = 0;
    let repairFailed = 0;

    for (const section of sections) {
      totalInputTokens += section.tokensUsed.input;
      totalOutputTokens += section.tokensUsed.output;
      totalRepairs += section.repairAttempts;
      if (section.verificationStatus === 'repair_failed') repairFailed++;

      for (const chain of section.evidenceChains) {
        for (const ev of [...chain.statutes, ...chain.caseLaw]) {
          totalCitations++;
          if (ev.verified) verifiedCitations++;
        }
      }

      hallucinationSignals += section.confidence.ungroundedCount;
      hallucinationSignals += section.confidence.contradictions;
    }

    const citationAccuracyRate =
      totalCitations > 0 ? verifiedCitations / totalCitations : 1;

    const snapshot: DraftV2MetricsSnapshot = {
      draftId: meta.draftId,
      documentKind: meta.documentKind,
      jurisdiction: meta.jurisdiction,
      engineVersion: 'v2',
      totalSections: confidenceReport.totalSections,
      verifiedSections: confidenceReport.verifiedSections,
      needsReviewSections: confidenceReport.needsReviewSections,
      repairFailed,
      repairTriggered: confidenceReport.repairTriggered,
      totalRepairs,
      overallConfidenceScore: confidenceReport.overallScore,
      overallConfidenceGrade: confidenceReport.overallGrade,
      citationAccuracyRate: Math.round(citationAccuracyRate * 100) / 100,
      hallucinationSignals,
      totalInputTokens,
      totalOutputTokens,
      estimatedCostUsd: meta.estimatedCostUsd ?? 0,
      latencyMs: meta.latencyMs,
      shadowDivergence: meta.shadowDivergence,
    };

    this.logger.log(
      JSON.stringify({ event: 'draft_v2_generation', ...snapshot }),
    );

    // Log per-section breakdown at debug level
    for (const section of sections) {
      this.logger.debug(
        JSON.stringify({
          event: 'draft_v2_section',
          draftId: meta.draftId,
          sectionId: section.sectionId,
          type: section.type,
          confidenceScore: section.confidence.score,
          confidenceGrade: section.confidence.grade,
          verificationStatus: section.verificationStatus,
          repairAttempts: section.repairAttempts,
          modelUsed: section.modelUsed,
          inputTokens: section.tokensUsed.input,
          outputTokens: section.tokensUsed.output,
          evidenceChainCount: section.evidenceChains.length,
          isBoilerplate: section.isInjectedBoilerplate,
        }),
      );
    }

    // Log verification warning breakdown
    if (verificationReport.overallWarnings.length > 0) {
      this.logger.warn(
        JSON.stringify({
          event: 'draft_v2_warnings',
          draftId: meta.draftId,
          warningCount: verificationReport.overallWarnings.length,
          requiresLawyerReview: verificationReport.requiresLawyerReview,
        }),
      );
    }
  }

  /**
   * Record a shadow-mode divergence between v1 and v2 outputs.
   * Called when running in shadow mode to log confidence/quality differences.
   */
  recordShadowComparison(params: {
    draftId: string;
    documentKind: string;
    jurisdiction: string;
    v1VerificationStatus: string;
    v2OverallConfidence: number;
    v2OverallGrade: string;
    v2RepairCount: number;
    divergenceDetails: string[];
  }): void {
    const { divergenceDetails, ...metadata } = params;
    this.logger.log(
      JSON.stringify({
        event: 'draft_v2_shadow_comparison',
        ...metadata,
        divergenceCount: divergenceDetails.length,
      }),
    );
  }

  /**
   * Record a targeted repair event (per section).
   */
  recordRepair(params: {
    draftId: string;
    sectionId: string;
    sectionType: string;
    attemptNumber: number;
    success: boolean;
    failureReason?: string;
  }): void {
    const { failureReason, ...metadata } = params;
    this.logger.log(
      JSON.stringify({ event: 'draft_v2_repair', ...metadata, hasFailureReason: Boolean(failureReason) }),
    );
  }
}
