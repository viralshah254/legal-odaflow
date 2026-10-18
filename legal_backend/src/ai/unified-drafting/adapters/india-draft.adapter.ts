import { Injectable, Logger } from '@nestjs/common';
import { DraftJobService } from '../draft-job.service';
import type { GenerateIndiaDraftDto } from '@/ai/india-draft/india-draft.dto';
import type { DraftAuthContext } from '@/ai/india-draft/india-draft.service';
import { resolveBundleResearchMemoKind } from '@/ai/drafting/draft-kind.util';
import { isUnifiedDraftEngineEnabled } from '../unified-draft-routing.policy';

/**
 * India Draft Adapter
 *
 * Bridges the legacy POST /ai/india-draft/generate endpoint into the
 * new unified DraftJobService. The legacy controller remains unchanged
 * while the engine underneath is replaced.
 *
 * Enabled when feature flag UNIFIED_DRAFT_ENGINE_ENABLED=true.
 * The rollout percentage is controlled by UNIFIED_DRAFT_ENGINE_PERCENT (0–100).
 */
@Injectable()
export class IndiaDraftAdapter {
  private readonly logger = new Logger(IndiaDraftAdapter.name);

  constructor(private readonly draftJobService: DraftJobService) {}

  /** Returns true when this adapter should handle the request. */
  isEnabled(tenantId: string, userId: string): boolean {
    return isUnifiedDraftEngineEnabled(tenantId, userId);
  }

  async createJob(dto: GenerateIndiaDraftDto, ctx: DraftAuthContext) {
    const qualityTier = this.resolveQualityTier(dto);
    const documentKind =
      dto.bundleMode && (dto.bundleIndex ?? 0) === 0
        ? resolveBundleResearchMemoKind(dto.kind, dto.caseDetails ?? '')
        : dto.kind;

    const job = await this.draftJobService.create({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      matterId: dto.matterId,
      profile: 'india_court',
      documentKind,
      qualityTier,
      facts: dto.caseDetails,
      jurisdiction: dto.jurisdiction ?? 'IN',
      courtName: dto.courtName,
      clientName: dto.clientName,
      opposingParty: dto.opposingParty,
      parties: dto.parties,
      attachmentContext: dto.attachmentContext,
      formNumber: dto.formNumber,
      language: dto.language,
      pinnedSections: dto.pinnedSections,
      pinnedCaseLaws: dto.pinnedCaseLaws,
      confirmedCaseRecord: dto.confirmedCaseRecord as Record<string, unknown> | undefined,
      accuracyMode: dto.accuracyMode,
      bundleMode: dto.bundleMode,
      bundleIndex: dto.bundleIndex,
      knowledgeSources: dto.knowledgeSources,
      idempotencyKey: `${ctx.userId}:${dto.kind}:${Date.now()}`,
    });

    this.logger.log(`India draft routed to unified engine — job ${job.jobId} for kind=${documentKind}`);

    return {
      jobId: job.jobId,
      status: job.status,
      migratedToAsyncEngine: true,
      estimatedCredits: job.estimatedCredits,
      message: 'Your draft is being generated. Poll GET /draft-jobs/:jobId for status.',
    };
  }

  private resolveQualityTier(dto: GenerateIndiaDraftDto): 'express' | 'standard' | 'premium' {
    const modelMode = (dto as { modelMode?: string }).modelMode;
    if (modelMode === 'PREMIUM') return 'premium';
    const isExpress = /notice|reminder|affidavit|simple_letter/i.test(dto.kind);
    if (isExpress) return 'express';
    return 'standard';
  }
}
