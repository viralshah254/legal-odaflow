import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { LlmCompletionService } from '@/ai/llm-completion.service';
import { ConfigService } from '@nestjs/config';

export interface LeadScore {
  leadId: string;
  score: number; // 0-100
  tier: 'hot' | 'warm' | 'cold';
  conversionProbability: number; // 0.0-1.0
  urgencyLevel: 'critical' | 'high' | 'medium' | 'low';
  reasons: string[];
  recommendedAction: string;
}

export interface LeadScoringResult {
  scores: LeadScore[];
  highPriorityCount: number;
  summary: string;
}

@Injectable()
export class LeadScoringService {
  private readonly logger = new Logger(LeadScoringService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llmCompletion: LlmCompletionService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Score and triage all open leads for a tenant using LLM analysis.
   */
  async scoreLeads(params: { tenantId: string }): Promise<LeadScoringResult> {
    const leads = await this.prisma.lawyerLead.findMany({
      where: {
        tenantId: params.tenantId,
        intakeStage: { notIn: ['CONVERTED', 'DECLINED'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    if (leads.length === 0) {
      return { scores: [], highPriorityCount: 0, summary: 'No open leads to score.' };
    }

    const leadText = leads
      .map(
        (l, i) =>
          `${i + 1}. [${l.id}] Issue: ${l.issueType} | Urgency: ${l.urgency} | Stage: ${l.intakeStage} | Country: ${l.countryCode} | Summary: ${(l.summary ?? '').slice(0, 100)}`,
      )
      .join('\n');

    const prompt = `You are a legal business development AI. Score and triage these client leads to prioritize the firm's follow-up.

Open Leads:
${leadText}

Scoring criteria: urgency, issue complexity, client engagement signals, conversion likelihood.

Return JSON:
{
  "scores": [
    {
      "leadId": "the-exact-lead-id",
      "score": 85,
      "tier": "hot",
      "conversionProbability": 0.8,
      "urgencyLevel": "high",
      "reasons": ["High urgency matter", "Well-described facts"],
      "recommendedAction": "Schedule call within 24 hours"
    }
  ],
  "summary": "..."
}`;

    try {
      const fastModel = this.configService.get<string>('AI_FAST_MODEL', 'gpt-4.1-mini');
      const result = await this.llmCompletion.complete({
        modelName: fastModel,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        maxTokens: 1500,
      });

      const jsonMatch = result.content.match(/\{[\s\S]+\}/);
      if (!jsonMatch) throw new Error('No JSON in response');

      const parsed = JSON.parse(jsonMatch[0]) as { scores: LeadScore[]; summary: string };
      const scores = (parsed.scores ?? []).slice(0, 50);
      const highPriorityCount = scores.filter(
        (s) => s.tier === 'hot' || s.urgencyLevel === 'critical',
      ).length;

      return {
        scores,
        highPriorityCount,
        summary: parsed.summary ?? 'Lead scoring complete.',
      };
    } catch (e) {
      this.logger.error(`Lead scoring failed: ${e}`);
      return {
        scores: [],
        highPriorityCount: 0,
        summary: 'Scoring failed. Please try again.',
      };
    }
  }

  /**
   * Score a single lead.
   */
  async scoreLead(params: { leadId: string; tenantId: string }): Promise<LeadScore> {
    const result = await this.scoreLeads({ tenantId: params.tenantId });
    const found = result.scores.find((s) => s.leadId === params.leadId);
    return (
      found ?? {
        leadId: params.leadId,
        score: 50,
        tier: 'warm',
        conversionProbability: 0.5,
        urgencyLevel: 'medium',
        reasons: ['Insufficient data for scoring'],
        recommendedAction: 'Review lead details and follow up',
      }
    );
  }
}
