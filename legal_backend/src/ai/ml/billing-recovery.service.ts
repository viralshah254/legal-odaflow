import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { LlmCompletionService } from '@/ai/llm-completion.service';
import { ConfigService } from '@nestjs/config';

export interface BillingSuggestion {
  type: 'missed_time' | 'narrative_improvement' | 'rate_adjustment';
  description: string;
  estimatedValue: number; // USD
  timeEntryId?: string;
  suggestedNarrative?: string;
  priority: 'high' | 'medium' | 'low';
}

export interface BillingRecoveryResult {
  totalPotentialRecovery: number;
  suggestions: BillingSuggestion[];
  summary: string;
}

@Injectable()
export class BillingRecoveryService {
  private readonly logger = new Logger(BillingRecoveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llmCompletion: LlmCompletionService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Analyze unbilled/recent time entries for a tenant and suggest improvements.
   * Identifies missed time, vague narratives, and rate inconsistencies.
   */
  async analyzeBillingRecovery(params: {
    tenantId: string;
    matterId?: string;
    daysBack?: number;
  }): Promise<BillingRecoveryResult> {
    const since = new Date(
      Date.now() - (params.daysBack ?? 30) * 24 * 60 * 60 * 1000,
    );

    const timeEntries = await this.prisma.timeEntry.findMany({
      where: {
        tenantId: params.tenantId,
        ...(params.matterId ? { matterId: params.matterId } : {}),
        status: 'DRAFT', // unbilled / not yet invoiced
        createdAt: { gte: since },
      },
      include: {
        matter: { select: { title: true, practiceArea: true } },
      },
      orderBy: { date: 'desc' },
      take: 50,
    });

    if (timeEntries.length === 0) {
      return {
        totalPotentialRecovery: 0,
        suggestions: [],
        summary: 'No unbilled time entries found in the selected period.',
      };
    }

    const entryText = timeEntries
      .map(
        (e, i) =>
          `${i + 1}. [${e.id}] ${e.minutes}min | Rate: $${e.rate ?? 0}/hr | Matter: ${e.matter?.title ?? e.matterId ?? 'N/A'} | Narrative: "${e.narrative ?? 'none'}"`,
      )
      .join('\n');

    const prompt = `You are a legal billing consultant. Analyze these unbilled time entries and suggest improvements to maximize recovery.

Time Entries (last ${params.daysBack ?? 30} days):
${entryText}

Identify:
1. Entries with vague/weak narratives that may be questioned
2. Time gaps suggesting missed time capture
3. Rate inconsistencies
4. Best practices for narrative writing

Return JSON:
{
  "totalPotentialRecovery": 1200.00,
  "suggestions": [
    {
      "type": "narrative_improvement",
      "description": "Entry #1 has vague narrative 'Meeting' - could be challenged",
      "estimatedValue": 150.00,
      "timeEntryId": "the-id",
      "suggestedNarrative": "Telephone conference with client regarding employment contract negotiation strategy and review of proposed amendments",
      "priority": "high"
    }
  ],
  "summary": "..."
}`;

    try {
      const fastModel = this.configService.get<string>('AI_FAST_MODEL', 'gpt-4.1-mini');
      const result = await this.llmCompletion.complete({
        modelName: fastModel,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        maxTokens: 1200,
      });

      const jsonMatch = result.content.match(/\{[\s\S]+\}/);
      if (!jsonMatch) throw new Error('No JSON in response');

      const parsed = JSON.parse(jsonMatch[0]) as BillingRecoveryResult;
      return {
        totalPotentialRecovery: parsed.totalPotentialRecovery ?? 0,
        suggestions: (parsed.suggestions ?? []).slice(0, 20),
        summary: parsed.summary ?? 'Analysis complete.',
      };
    } catch (e) {
      this.logger.error(`Billing recovery analysis failed: ${e}`);
      return {
        totalPotentialRecovery: 0,
        suggestions: [],
        summary: 'Analysis failed. Please try again.',
      };
    }
  }
}
