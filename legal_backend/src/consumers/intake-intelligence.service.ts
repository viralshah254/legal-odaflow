import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LlmCompletionService } from '@/ai/llm-completion.service';
import { DEFAULT_AUTO_MODEL } from '@/ai/model-costs.config';
import { getIntakeIntent, type IntakeIntent } from './issue-checker.constants';

export type IntakeToolPlanItem = 'retrieve' | 'section_finder' | 'draft' | 'strategy';

export interface IntakeIntelligenceResult {
  intent: IntakeIntent;
  jurisdictionHints: string[];
  missingSlots: string[];
  toolPlan: IntakeToolPlanItem[];
  /** Primary next surface for lead UI / API. */
  recommendedNextTool: IntakeToolPlanItem;
}

const TOOL_PLAN_ITEMS: IntakeToolPlanItem[] = [
  'retrieve',
  'section_finder',
  'draft',
  'strategy',
];

@Injectable()
export class IntakeIntelligenceService {
  private readonly logger = new Logger(IntakeIntelligenceService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly llm: LlmCompletionService,
  ) {}

  /**
   * One cheap intelligence pass after classify facts:
   * intent, jurisdiction hints, missing slots, and tool plan.
   */
  async analyze(input: {
    facts: string;
    countryCode: string;
    issueType?: string;
    mode?: string;
    jurisdiction?: string;
  }): Promise<IntakeIntelligenceResult> {
    const countryCode = input.countryCode.toUpperCase();
    const heuristic = this.heuristicFallback(input);

    const modelName =
      this.configService.get<string>('AI_LEGAL_FAST_MODEL') ||
      this.configService.get<string>('AI_CHEAP_MODEL') ||
      DEFAULT_AUTO_MODEL;

    if (!this.llm.isModelConfigured(modelName)) {
      return heuristic;
    }

    try {
      const completion = await this.llm.complete({
        modelName,
        messages: [
          {
            role: 'system',
            content: [
              'You are a legal intake planner. Return ONLY JSON:',
              '{"intent":"TRANSACTIONAL_DRAFT|DISPUTE_ADVISORY|GENERAL_ADVISORY","jurisdictionHints":[],"missingSlots":[],"toolPlan":["retrieve"|"section_finder"|"draft"|"strategy"]}',
              'toolPlan: ordered tools to run next. Include section_finder for statute-heavy disputes.',
              'TRANSACTIONAL_DRAFT → prefer draft (+ retrieve). DISPUTE_ADVISORY → prefer strategy (+ retrieve/section_finder).',
              'missingSlots: short field ids still needed (e.g. opposingParty, dates, amount, documents). Max 6.',
              'jurisdictionHints: courts/states/caps mentioned or implied. Max 4.',
            ].join(' '),
          },
          {
            role: 'user',
            content: [
              `Country: ${countryCode}`,
              input.jurisdiction ? `Jurisdiction hint: ${input.jurisdiction}` : '',
              input.issueType ? `Classified issue type: ${input.issueType}` : '',
              input.mode ? `Mode: ${input.mode}` : '',
              `Facts: ${input.facts.slice(0, 2500)}`,
            ]
              .filter(Boolean)
              .join('\n'),
          },
        ],
        maxTokens: 500,
        temperature: 0.1,
      });

      const text = completion.content ?? '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return heuristic;

      const parsed = JSON.parse(jsonMatch[0]) as {
        intent?: string;
        jurisdictionHints?: unknown;
        missingSlots?: unknown;
        toolPlan?: unknown;
      };

      const intent = this.normalizeIntent(parsed.intent) ?? heuristic.intent;
      const toolPlan = this.normalizeToolPlan(parsed.toolPlan, intent);
      return {
        intent,
        jurisdictionHints: this.normalizeStringList(parsed.jurisdictionHints, 4),
        missingSlots: this.normalizeStringList(parsed.missingSlots, 6),
        toolPlan,
        recommendedNextTool: this.pickRecommendedNextTool(toolPlan, intent),
      };
    } catch (err) {
      this.logger.warn(
        `Intake intelligence pass failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return heuristic;
    }
  }

  heuristicFallback(input: {
    facts: string;
    countryCode: string;
    issueType?: string;
    jurisdiction?: string;
  }): IntakeIntelligenceResult {
    const intent = getIntakeIntent(input.issueType, input.facts);
    const toolPlan = this.defaultToolPlan(intent, input.countryCode);
    const jurisdictionHints = input.jurisdiction?.trim()
      ? [input.jurisdiction.trim()]
      : [];
    const missingSlots: string[] = [];
    if (!/\b(date|on\s+\d|january|february|march|april|may|june|july|august|september|october|november|december)\b/i.test(input.facts)) {
      missingSlots.push('keyDates');
    }
    if (!/\b(rs\.?|inr|kes|usd|\$|amount|sum of)\b/i.test(input.facts)) {
      if (intent !== 'GENERAL_ADVISORY') missingSlots.push('amountOrValue');
    }
    if (input.facts.trim().length < 80) {
      missingSlots.push('moreFacts');
    }

    return {
      intent,
      jurisdictionHints,
      missingSlots: missingSlots.slice(0, 6),
      toolPlan,
      recommendedNextTool: this.pickRecommendedNextTool(toolPlan, intent),
    };
  }

  private defaultToolPlan(intent: IntakeIntent, countryCode: string): IntakeToolPlanItem[] {
    const code = countryCode.toUpperCase();
    const sf = code === 'IN' || code === 'KE' ? (['section_finder'] as IntakeToolPlanItem[]) : [];
    if (intent === 'TRANSACTIONAL_DRAFT') {
      return ['draft', 'retrieve', ...sf];
    }
    if (intent === 'DISPUTE_ADVISORY') {
      return ['strategy', 'retrieve', ...sf];
    }
    return ['retrieve', ...sf, 'strategy'];
  }

  private normalizeIntent(raw?: string): IntakeIntent | undefined {
    if (raw === 'TRANSACTIONAL_DRAFT' || raw === 'DISPUTE_ADVISORY' || raw === 'GENERAL_ADVISORY') {
      return raw;
    }
    return undefined;
  }

  private normalizeToolPlan(raw: unknown, intent: IntakeIntent): IntakeToolPlanItem[] {
    const fromAi = Array.isArray(raw)
      ? raw
          .map((item) => String(item))
          .filter((item): item is IntakeToolPlanItem =>
            TOOL_PLAN_ITEMS.includes(item as IntakeToolPlanItem),
          )
      : [];
    if (fromAi.length === 0) {
      return this.defaultToolPlan(intent, 'IN');
    }
    // Ensure intent-aligned primary tool is present.
    if (intent === 'TRANSACTIONAL_DRAFT' && !fromAi.includes('draft')) {
      fromAi.unshift('draft');
    }
    if (intent === 'DISPUTE_ADVISORY' && !fromAi.includes('strategy')) {
      fromAi.unshift('strategy');
    }
    return [...new Set(fromAi)].slice(0, 4);
  }

  private normalizeStringList(raw: unknown, max: number): string[] {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((v) => String(v ?? '').trim())
      .filter((v) => v.length > 0 && v.length < 80)
      .slice(0, max);
  }

  pickRecommendedNextTool(
    toolPlan: IntakeToolPlanItem[],
    intent: IntakeIntent,
  ): IntakeToolPlanItem {
    if (intent === 'TRANSACTIONAL_DRAFT') return 'draft';
    if (intent === 'DISPUTE_ADVISORY') {
      return toolPlan.includes('strategy') ? 'strategy' : 'retrieve';
    }
    return toolPlan[0] ?? 'retrieve';
  }
}
