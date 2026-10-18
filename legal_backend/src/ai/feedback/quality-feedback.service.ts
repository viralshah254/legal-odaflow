import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { DraftFeedbackService } from './draft-feedback.service';

export interface FeedbackEvent {
  tenantId: string;
  userId: string;
  feature: string;           // drafting | research | strategy | document_review
  taskType: string;          // section_type, document_type, etc.
  modelUsed: string;         // gpt-5.4-mini, claude-3-opus, etc.
  jurisdiction?: string;
  originalContent: string;
  editedContent: string;
  editType: 'accept' | 'minor_edit' | 'major_edit' | 'reject';
  costUsd?: number;
  latencyMs?: number;
  documentKind?: string;
  draftSectionV3Id?: string;
}

interface FeedbackMetrics {
  totalEvents: number;
  acceptRate: number;
  minorEditRate: number;
  majorEditRate: number;
  rejectRate: number;
  avgCostUsd: number;
  avgEditDistance: number;
  recommendation: 'use_current' | 'try_cheaper' | 'try_premium';
}

/**
 * Records user edits to AI-generated content as feedback signals,
 * computes quality metrics per model/task, and adjusts model routing
 * preferences stored in the AiModelAlias table.
 *
 * Also mirrors drafting events into DraftSectionFeedback so the nightly
 * training pipeline and model-routing share one source of truth.
 */
@Injectable()
export class QualityFeedbackService {
  private readonly logger = new Logger(QualityFeedbackService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly draftFeedback: DraftFeedbackService | null,
  ) {}

  /**
   * Record a feedback event when a user edits or accepts AI-generated content.
   */
  async recordFeedback(event: FeedbackEvent): Promise<void> {
    const editDistance = this.computeEditDistance(event.originalContent, event.editedContent);
    const editRatio = editDistance / Math.max(event.originalContent.length, 1);

    const derivedEditType = this.deriveEditType(editRatio, event.editType);

    await (this.prisma as any).aiQualityFeedback.create({
      data: {
        tenantId: event.tenantId,
        userId: event.userId,
        feature: event.feature,
        taskType: event.taskType,
        modelUsed: event.modelUsed,
        jurisdiction: event.jurisdiction,
        editType: derivedEditType,
        editRatio,
        editDistance,
        originalLength: event.originalContent.length,
        editedLength: event.editedContent.length,
        costUsd: event.costUsd ?? 0,
        latencyMs: event.latencyMs,
      },
    });

    // Mirror drafting edits into the training pipeline store
    if (event.feature === 'drafting' && this.draftFeedback) {
      const rating =
        derivedEditType === 'accept'
          ? 'accepted'
          : derivedEditType === 'reject'
            ? 'rejected'
            : derivedEditType === 'minor_edit'
              ? 'minor_edit'
              : 'major_edit';
      await this.draftFeedback.record({
        tenantId: event.tenantId,
        userId: event.userId,
        documentKind: event.documentKind ?? 'platform_v3',
        sectionType: event.taskType,
        jurisdiction: event.jurisdiction,
        rating,
        aiText: event.originalContent,
        userText: event.editedContent,
        draftSectionV3Id: event.draftSectionV3Id,
        modelUsed: event.modelUsed,
      }).catch(() => {});
    }

    // Async: update model routing preferences if we have enough data
    this.updateModelRoutingAsync(event.feature, event.taskType, event.modelUsed, event.tenantId).catch(
      () => {},
    );
  }

  /**
   * Get aggregated quality metrics for a model/task combination.
   */
  async getMetrics(
    feature: string,
    taskType?: string,
    modelUsed?: string,
    tenantId?: string,
  ): Promise<FeedbackMetrics> {
    const events = await (this.prisma as any).aiQualityFeedback.findMany({
      where: {
        feature,
        ...(taskType ? { taskType } : {}),
        ...(modelUsed ? { modelUsed } : {}),
        ...(tenantId ? { tenantId } : {}),
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, // last 30 days
      },
    });

    if (events.length === 0) {
      return {
        totalEvents: 0,
        acceptRate: 0,
        minorEditRate: 0,
        majorEditRate: 0,
        rejectRate: 0,
        avgCostUsd: 0,
        avgEditDistance: 0,
        recommendation: 'use_current',
      };
    }

    const counts = { accept: 0, minor_edit: 0, major_edit: 0, reject: 0 };
    let totalCost = 0;
    let totalEditDistance = 0;

    for (const ev of events) {
      const type = ev.editType as keyof typeof counts;
      if (type in counts) counts[type]++;
      totalCost += ev.costUsd;
      totalEditDistance += ev.editDistance;
    }

    const total = events.length;
    const acceptRate = counts.accept / total;
    const rejectRate = counts.reject / total;
    const avgEditDistance = totalEditDistance / total;

    let recommendation: FeedbackMetrics['recommendation'] = 'use_current';
    if (acceptRate > 0.8 && (totalCost / total) > 0.005) {
      recommendation = 'try_cheaper';
    } else if (rejectRate > 0.3 || avgEditDistance > 500) {
      recommendation = 'try_premium';
    }

    return {
      totalEvents: total,
      acceptRate,
      minorEditRate: counts.minor_edit / total,
      majorEditRate: counts.major_edit / total,
      rejectRate,
      avgCostUsd: totalCost / total,
      avgEditDistance,
      recommendation,
    };
  }

  /**
   * Update model routing preferences based on feedback.
   * If quality is high with a cheaper model → update default alias to cheaper model.
   * If quality is poor → escalate to premium model.
   */
  private async updateModelRoutingAsync(
    feature: string,
    taskType: string,
    modelUsed: string,
    tenantId: string,
  ): Promise<void> {
    const metrics = await this.getMetrics(feature, taskType, modelUsed, tenantId);

    if (metrics.totalEvents < 10) return; // Need enough data

    const aliasKey = `${feature}:${taskType}`;

    if (metrics.recommendation === 'try_cheaper' && !modelUsed.includes('gpt-5.4-mini')) {
      const targetModelId = await this.prisma.aiModel.findFirst({
        where: { providerModelId: 'gpt-5.4-mini', enabled: true },
        select: { id: true },
      }).then((m) => m?.id).catch(() => undefined);

      if (targetModelId) {
        await this.prisma.aiModelAlias.upsert({
          where: { alias: aliasKey },
          create: { alias: aliasKey, aiModelId: targetModelId },
          update: { aiModelId: targetModelId },
        }).catch(() => {});
      }

      this.logger.log(
        `Model routing updated for ${aliasKey}: downgraded to gpt-5.4-mini (${(metrics.acceptRate * 100).toFixed(0)}% accept rate)`,
      );
    } else if (metrics.recommendation === 'try_premium') {
      const targetModelId = await this.prisma.aiModel.findFirst({
        where: {
          OR: [
            { providerModelId: 'gpt-5.6-terra' },
            { providerModelId: 'gpt-5.5' },
          ],
          enabled: true,
        },
        select: { id: true },
      }).then((m) => m?.id).catch(() => undefined);

      if (targetModelId) {
        await this.prisma.aiModelAlias.upsert({
          where: { alias: aliasKey },
          create: { alias: aliasKey, aiModelId: targetModelId },
          update: { aiModelId: targetModelId },
        }).catch(() => {});
      }

      this.logger.log(
        `Model routing updated for ${aliasKey}: upgraded to premium (${(metrics.rejectRate * 100).toFixed(0)}% reject rate)`,
      );
    }
  }

  private deriveEditType(
    editRatio: number,
    explicitType: FeedbackEvent['editType'],
  ): string {
    if (explicitType === 'accept') return 'accept';
    if (explicitType === 'reject') return 'reject';
    if (editRatio < 0.05) return 'accept';
    if (editRatio < 0.2) return 'minor_edit';
    return 'major_edit';
  }

  /**
   * Compute edit distance as character overlap difference (simple, fast).
   * For production, use Levenshtein with a threshold.
   */
  private computeEditDistance(original: string, edited: string): number {
    const a = original.toLowerCase().slice(0, 2000);
    const b = edited.toLowerCase().slice(0, 2000);

    // Count shared bigrams as similarity; distance is 1 - similarity
    const bigramsA = new Set<string>();
    for (let i = 0; i < a.length - 1; i++) {
      bigramsA.add(a.slice(i, i + 2));
    }

    let shared = 0;
    for (let i = 0; i < b.length - 1; i++) {
      if (bigramsA.has(b.slice(i, i + 2))) shared++;
    }

    const total = (a.length + b.length) / 2;
    const similarity = shared / Math.max(total, 1);
    return Math.round((1 - similarity) * Math.max(a.length, b.length));
  }
}
