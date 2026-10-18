/**
 * Drafting Engine v2 — Shadow Mode Service
 *
 * When DRAFT_ENGINE_V2_SHADOW=true, the v2 engine runs on all requests and
 * its output is compared against the legacy v1 output. Neither the caller
 * nor credits are affected — the v1 output is always returned to the user.
 *
 * This is the safe path for proving v2 parity before flipping the default,
 * mirroring the mi-shadow-mode.service.ts pattern.
 *
 * Metrics emitted:
 *  - draft_v2_shadow_quality: per-document comparison (confidence, repair count)
 *  - draft_v2_shadow_length_diff: character delta between v1 and v2 drafts
 *  - draft_v2_shadow_warning_diff: warning count delta
 */

import { Injectable, Logger } from '@nestjs/common';
import type { GenerateIndiaDraftResult } from '@/ai/india-draft/india-draft.dto';
import type { DraftV2Result } from './drafting-v2.types';

export interface ShadowComparisonResult {
  diverged: boolean;
  v1VerificationStatus: string;
  v2OverallConfidence: number;
  v2OverallGrade: string;
  v2RepairCount: number;
  v1Warnings: number;
  v2Warnings: number;
  v1DraftLength: number;
  v2DraftLength: number;
  lengthDeltaPct: number;
  warningDelta: number;
}

/** Activate shadow mode by setting DRAFT_ENGINE_V2_SHADOW=true in env. */
export function isDraftEngineV2ShadowEnabled(): boolean {
  return process.env.DRAFT_ENGINE_V2_SHADOW === 'true';
}

/**
 * Returns true only for the configured sample percentage of requests.
 * Default: 2%. Override with SHADOW_EVALUATION_PERCENT env var (0–100).
 *
 * Uses a stable hash of the job ID so the same job always maps to the same
 * decision, and we never shadow retries of a job that was not sampled.
 */
export function shouldRunShadowEvaluation(jobSalt: string): boolean {
  if (!isDraftEngineV2ShadowEnabled()) return false;
  const pct = Math.min(100, Math.max(0, Number(process.env.SHADOW_EVALUATION_PERCENT ?? '2')));
  if (pct === 0) return false;
  if (pct >= 100) return true;
  // Stable numeric hash of the salt string
  let h = 0;
  for (let i = 0; i < jobSalt.length; i++) {
    h = (Math.imul(31, h) + jobSalt.charCodeAt(i)) >>> 0;
  }
  return h % 100 < pct;
}

@Injectable()
export class DraftingV2ShadowService {
  private readonly logger = new Logger(DraftingV2ShadowService.name);

  /**
   * Compare v1 and v2 draft outputs and log divergence.
   * Always returns the v1 result so the caller is unaffected.
   */
  compare(
    documentKind: string,
    jurisdiction: string,
    v1Result: GenerateIndiaDraftResult,
    v2Result: DraftV2Result,
  ): ShadowComparisonResult {
    const v1Status = v1Result.verification?.verificationStatus ?? 'unknown';
    const v2Confidence = v2Result.confidenceReport.overallScore;
    const v2Grade = v2Result.confidenceReport.overallGrade;
    const v2Repairs = v2Result.confidenceReport.totalRepairs;

    const v1Warnings =
      (v1Result.verification?.citationWarnings.length ?? 0) +
      (v1Result.verification?.proceduralWarnings.length ?? 0) +
      (v1Result.verification?.completenessGaps.length ?? 0);

    const v2Warnings = v2Result.verificationReport.overallWarnings.length +
      v2Result.verificationReport.sectionStatuses.reduce(
        (sum, s) => sum + s.warnings.length,
        0,
      );

    const v1Len = v1Result.draft.length;
    const v2Len = v2Result.draft.length;
    const lengthDeltaPct = v1Len > 0 ? Math.round(((v2Len - v1Len) / v1Len) * 100) : 0;
    const warningDelta = v2Warnings - v1Warnings;

    // "Diverged" when v2 has meaningfully different quality signals
    const diverged =
      Math.abs(lengthDeltaPct) > 30 ||
      Math.abs(warningDelta) > 3 ||
      (v1Status === 'verified' && v2Grade === 'low') ||
      (v1Status !== 'verified' && v2Grade === 'high');

    const comparison: ShadowComparisonResult = {
      diverged,
      v1VerificationStatus: v1Status,
      v2OverallConfidence: v2Confidence,
      v2OverallGrade: v2Grade,
      v2RepairCount: v2Repairs,
      v1Warnings,
      v2Warnings,
      v1DraftLength: v1Len,
      v2DraftLength: v2Len,
      lengthDeltaPct,
      warningDelta,
    };

    if (diverged) {
      this.logger.warn(
        JSON.stringify({
          event: 'draft_v2_shadow_divergence',
          documentKind,
          jurisdiction,
          ...comparison,
        }),
      );
    } else {
      this.logger.log(
        JSON.stringify({
          event: 'draft_v2_shadow_quality',
          documentKind,
          jurisdiction,
          ...comparison,
        }),
      );
    }

    return comparison;
  }
}
