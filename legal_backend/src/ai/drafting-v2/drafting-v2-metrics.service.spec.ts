import { Logger } from '@nestjs/common';
import { DraftingV2MetricsService } from './drafting-v2-metrics.service';
import type { DraftV2Result } from './drafting-v2.types';

describe('Confidential drafting telemetry', () => {
  afterEach(() => jest.restoreAllMocks());

  it('keeps case-bearing warning, divergence and repair text out of operational logs', () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const debug = jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
    const confidential = 'PRIVATE_CLIENT_FACTS_AND_CASE_STRATEGY';
    const service = new DraftingV2MetricsService();
    service.recordGeneration({
      confidenceReport: { totalSections: 0, verifiedSections: 0, needsReviewSections: 0, repairTriggered: false, totalRepairs: 0, overallScore: 0, overallGrade: 'unverified' },
      verificationReport: { overallWarnings: [confidential], requiresLawyerReview: true },
      sections: [],
    } as unknown as DraftV2Result, { draftId: 'draft-opaque-id', documentKind: 'bail', jurisdiction: 'IN', latencyMs: 100 });
    service.recordShadowComparison({ draftId: 'draft-opaque-id', documentKind: 'bail', jurisdiction: 'IN', v1VerificationStatus: 'needs_review', v2OverallConfidence: 0, v2OverallGrade: 'unverified', v2RepairCount: 0, divergenceDetails: [confidential] });
    service.recordRepair({ draftId: 'draft-opaque-id', sectionId: 'grounds', sectionType: 'grounds', attemptNumber: 1, success: false, failureReason: confidential });
    expect(JSON.stringify([warn.mock.calls, log.mock.calls, debug.mock.calls])).not.toContain(confidential);
    expect(JSON.parse(warn.mock.calls[0][0])).toMatchObject({ warningCount: 1, requiresLawyerReview: true });
    expect(log.mock.calls.map((call) => JSON.parse(call[0]))).toEqual(expect.arrayContaining([
      expect.objectContaining({ event: 'draft_v2_shadow_comparison', divergenceCount: 1 }),
      expect.objectContaining({ event: 'draft_v2_repair', hasFailureReason: true }),
    ]));
  });
});
