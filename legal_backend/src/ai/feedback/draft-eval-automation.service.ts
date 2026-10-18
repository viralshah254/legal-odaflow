import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '@/prisma/prisma.service';
import { UmbrellaLegalEvalHarness } from '@/eval/umbrella-legal-eval.harness';

/**
 * Weekly automation around the umbrella legal eval harness.
 * Uses a lightweight harness instance for sync draft benchmarks; retrieval
 * benchmark is skipped unless BARE_ACT lookup is wired via env flag.
 *
 * Persists scores and adjusts AiModelAlias routing on sustained regressions.
 */
@Injectable()
export class DraftEvalAutomationService {
  private readonly logger = new Logger(DraftEvalAutomationService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron('0 5 * * 1') // Mondays 05:00 UTC
  async runWeeklyEval(): Promise<void> {
    if (process.env.DISABLE_EVAL_AUTOMATION === '1') return;
    this.logger.log('Starting weekly legal eval automation');

    try {
      const result = await this.runNow();
      await (this.prisma as any).aiQualityFeedback.create({
        data: {
          tenantId: 'system',
          userId: 'eval-automation',
          feature: 'eval',
          taskType: 'weekly_umbrella',
          modelUsed: 'harness',
          editType: result.avgScore >= 0.85 ? 'accept' : 'major_edit',
          editRatio: 1 - result.avgScore,
          editDistance: 0,
          originalLength: Object.keys(result.details).length,
          editedLength: Object.values(result.details).filter((s) => s >= 0.85).length,
          costUsd: 0,
          latencyMs: null,
        },
      }).catch(() => {});

      this.logger.log(
        `Weekly eval avg ${(result.avgScore * 100).toFixed(0)}% — ${JSON.stringify(result.details)}`,
      );

      if (result.avgScore < 0.7 || (result.details.archetype ?? 1) < 0.7) {
        await this.escalateDraftingModels();
      }
    } catch (err) {
      this.logger.error(`Weekly eval failed: ${String(err)}`);
    }
  }

  /**
   * Runs deterministic draft benchmarks that do not require live retrieval DI.
   * Retrieval benchmark is omitted here to avoid circular module imports;
   * use GET /eval endpoints for full suite.
   */
  async runNow(): Promise<{ avgScore: number; details: Record<string, number> }> {
    // Construct with nulls — sync draft methods do not use constructor deps
    const harness = new UmbrellaLegalEvalHarness(null as any, null as any, null as any, null as any);
    const normalizer = harness.runDraftNormalizerBenchmark();
    const citationStrip = harness.runDraftCitationStripBenchmark();
    const archetype = harness.runDraftArchetypeGoldenBenchmark();
    const falseVerified = harness.runFalseVerifiedRateBenchmark();

    const details: Record<string, number> = {
      normalizer: normalizer.score,
      citationStrip: citationStrip.score,
      archetype: archetype.score,
      falseVerified: falseVerified.score,
    };
    const avg =
      Object.values(details).reduce((a, b) => a + b, 0) / Object.values(details).length;
    return { avgScore: avg, details };
  }

  private async escalateDraftingModels(): Promise<void> {
    const premium = await this.prisma.aiModel.findFirst({
      where: {
        OR: [
          { providerModelId: 'gpt-5.6-terra' },
          { providerModelId: 'gpt-5.6-sol' },
          { providerModelId: 'gpt-5.5' },
        ],
        enabled: true,
      },
      select: { id: true, providerModelId: true },
    });
    if (!premium) return;

    await this.prisma.aiModelAlias.upsert({
      where: { alias: 'drafting:eval-escalation' },
      create: {
        alias: 'drafting:eval-escalation',
        aiModelId: premium.id,
        taskType: 'india_court_draft',
      },
      update: { aiModelId: premium.id, enabled: true },
    }).catch(() => {});

    this.logger.warn(
      `Eval regression detected — escalated drafting alias to ${premium.providerModelId}`,
    );
  }
}
