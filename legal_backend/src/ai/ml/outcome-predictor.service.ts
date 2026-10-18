import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { LlmCompletionService } from '@/ai/llm-completion.service';
import { ConfigService } from '@nestjs/config';

export interface OutcomePrediction {
  winProbability: number; // 0.0 - 1.0
  confidence: 'high' | 'medium' | 'low';
  factors: Array<{ label: string; impact: 'positive' | 'negative' | 'neutral'; weight: number }>;
  suggestedActions: string[];
  comparableMatterCount: number;
  reasoning: string;
}

@Injectable()
export class OutcomePredictorService {
  private readonly logger = new Logger(OutcomePredictorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llmCompletion: LlmCompletionService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Predict the likely outcome/win probability for a matter.
   * Uses historical closed matters as training signal + LLM analysis.
   */
  async predictOutcome(params: {
    matterId: string;
    tenantId: string;
  }): Promise<OutcomePrediction> {
    const matter = await this.prisma.matter.findFirst({
      where: { id: params.matterId, tenantId: params.tenantId },
      include: {
        client: { select: { name: true } },
        tasks: { select: { status: true, priority: true }, take: 20 },
        documents: { select: { aiDraftStatus: true, mimeType: true }, take: 10 },
      },
    });

    if (!matter) {
      return this.defaultPrediction();
    }

    // Get historical closed matters for same practice area
    const historicalMatters = await this.prisma.matter.findMany({
      where: {
        tenantId: params.tenantId,
        practiceArea: matter.practiceArea,
        status: 'CLOSED',
        NOT: { id: params.matterId },
      },
      select: {
        title: true,
        factsSummary: true,
        desiredOutcome: true,
        jurisdiction: true,
      },
      take: 20,
      orderBy: { updatedAt: 'desc' },
    });

    const openTasks = matter.tasks.filter((t) => t.status !== 'DONE').length;
    const totalTasks = matter.tasks.length;
    const highPriorityOpen = matter.tasks.filter(
      (t) => t.priority === 'HIGH' && t.status !== 'DONE',
    ).length;
    const docCount = matter.documents.length;

    const prompt = `You are a legal analytics AI. Predict the win probability and key factors for this matter.

Current Matter:
- Practice Area: ${matter.practiceArea ?? 'general'}
- Stage: ${matter.stage ?? 'unknown'}
- Jurisdiction: ${matter.jurisdiction ?? 'unspecified'}
- Facts: ${matter.factsSummary ?? 'not provided'}
- Desired Outcome: ${matter.desiredOutcome ?? 'not specified'}
- Open Tasks: ${openTasks} of ${totalTasks}
- High Priority Open Tasks: ${highPriorityOpen}
- Documents: ${docCount}

Historical Closed Matters in Same Practice Area (${historicalMatters.length} total):
${historicalMatters
  .slice(0, 5)
  .map(
    (m, i) =>
      `${i + 1}. Facts: ${(m.factsSummary ?? '').slice(0, 100)} | Desired: ${(m.desiredOutcome ?? 'N/A').slice(0, 100)}`,
  )
  .join('\n')}

Respond with JSON only:
{
  "winProbability": 0.65,
  "confidence": "medium",
  "factors": [
    {"label": "...", "impact": "positive", "weight": 0.3},
    {"label": "...", "impact": "negative", "weight": 0.2}
  ],
  "suggestedActions": ["...", "..."],
  "reasoning": "..."
}`;

    try {
      const fastModel = this.configService.get<string>('AI_FAST_MODEL', 'gpt-4.1-mini');
      const result = await this.llmCompletion.complete({
        modelName: fastModel,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        maxTokens: 800,
      });

      const jsonMatch = result.content.match(/\{[\s\S]+\}/);
      if (!jsonMatch) return this.defaultPrediction(historicalMatters.length);

      const parsed = JSON.parse(jsonMatch[0]) as Partial<OutcomePrediction>;
      return {
        winProbability: Math.max(0, Math.min(1, parsed.winProbability ?? 0.5)),
        confidence: parsed.confidence ?? 'low',
        factors: parsed.factors ?? [],
        suggestedActions: parsed.suggestedActions ?? [],
        comparableMatterCount: historicalMatters.length,
        reasoning: parsed.reasoning ?? '',
      };
    } catch (e) {
      this.logger.error(`Outcome prediction failed: ${e}`);
      return this.defaultPrediction(historicalMatters.length);
    }
  }

  /**
   * Get firm-wide win rates by practice area using historical data.
   */
  async getFirmWinRates(tenantId: string): Promise<
    Array<{
      practiceArea: string;
      totalMatters: number;
      closedMatters: number;
      winRate: number | null;
    }>
  > {
    const closed = await this.prisma.matter.groupBy({
      by: ['practiceArea'],
      where: { tenantId, status: 'CLOSED' },
      _count: { id: true },
    });

    const all = await this.prisma.matter.groupBy({
      by: ['practiceArea'],
      where: { tenantId },
      _count: { id: true },
    });

    const allMap = new Map(all.map((r) => [r.practiceArea, r._count.id]));
    const closedMap = new Map(closed.map((r) => [r.practiceArea, r._count.id]));

    // Matters with positive outcome indicators (has desiredOutcome containing win keywords)
    const winIndicators = await this.prisma.matter.groupBy({
      by: ['practiceArea'],
      where: {
        tenantId,
        status: 'CLOSED',
        desiredOutcome: {
          contains: 'success',
          mode: 'insensitive',
        },
      },
      _count: { id: true },
    });
    const winMap = new Map(winIndicators.map((r) => [r.practiceArea, r._count.id]));

    const areas = Array.from(new Set([...allMap.keys()])).filter(Boolean);
    return areas.map((area) => {
      const total = allMap.get(area) ?? 0;
      const closedCount = closedMap.get(area) ?? 0;
      const wins = winMap.get(area) ?? 0;
      return {
        practiceArea: area ?? 'unknown',
        totalMatters: total,
        closedMatters: closedCount,
        winRate: closedCount > 0 ? wins / closedCount : null,
      };
    });
  }

  private defaultPrediction(comparableMatterCount = 0): OutcomePrediction {
    return {
      winProbability: 0.5,
      confidence: 'low',
      factors: [],
      suggestedActions: ['Gather more evidence', 'Complete intake questionnaire'],
      comparableMatterCount,
      reasoning: 'Insufficient data for prediction.',
    };
  }
}
