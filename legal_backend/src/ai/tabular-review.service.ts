import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { normalizeModelId } from './model-costs.config';
import { LlmCompletionService, type LlmFinishReason } from './llm-completion.service';

export type ChangeType = 'ADDED' | 'REMOVED' | 'MODIFIED' | 'UNCHANGED';
export type RiskLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE' | 'UNKNOWN';

export interface TabularReviewRow {
  clauseName: string;
  docAText: string | null;
  docBText: string | null;
  changeType: ChangeType;
  riskLevel: RiskLevel;
  riskDetail: string | null;
  recommendation: string | null;
}

export interface TabularReviewResult {
  rows: TabularReviewRow[];
  summary: string;
  totalClauses: number;
  changedClauses: number;
  highRiskClauses: number;
  creditsUsed: number;
  modelName: string;
}

const TABULAR_SYSTEM_PROMPT = `You are an expert legal contract comparison analyst.
Compare two documents clause-by-clause and return ONLY valid JSON — no markdown fences, no prose before or after.

Rules:
- Cover all material clauses: parties, recitals, definitions, scope, payment, term, termination, liability, indemnification, IP, confidentiality, governing law, dispute resolution, warranties, force majeure, and other significant clauses.
- docAText and docBText must be brief excerpts only (max 250 characters each). Use null if the clause is absent in that document.
- changeType: ADDED | REMOVED | MODIFIED | UNCHANGED
- riskLevel: HIGH | MEDIUM | LOW | NONE
- riskDetail and recommendation: concise (max 200 chars each); null when not applicable.

Return this exact JSON shape:
{
  "summary": "2-3 sentence executive summary",
  "rows": [
    {
      "clauseName": "string",
      "docAText": "string | null",
      "docBText": "string | null",
      "changeType": "ADDED|REMOVED|MODIFIED|UNCHANGED",
      "riskLevel": "HIGH|MEDIUM|LOW|NONE",
      "riskDetail": "string | null",
      "recommendation": "string | null"
    }
  ]
}`;

const PARSE_FALLBACK = {
  rows: [] as TabularReviewRow[],
  summary: 'Comparison could not be fully parsed.',
};

function isTruncated(finishReason: LlmFinishReason | undefined): boolean {
  return finishReason === 'max_tokens' || finishReason === 'length';
}

@Injectable()
export class TabularReviewService {
  private readonly logger = new Logger(TabularReviewService.name);

  constructor(
    private readonly llm: LlmCompletionService,
    private readonly configService: ConfigService,
  ) {}

  private parseTabularResponse(raw: string): { summary?: string; rows?: TabularReviewRow[] } {
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();

    const tryParse = (text: string): { summary?: string; rows?: TabularReviewRow[] } | null => {
      try {
        return JSON.parse(text) as { summary?: string; rows?: TabularReviewRow[] };
      } catch {
        return null;
      }
    };

    const direct = tryParse(cleaned);
    if (direct) return direct;

    const fenced = cleaned.match(/```json\s*([\s\S]*?)\s*```/i);
    if (fenced?.[1]) {
      const fromFence = tryParse(fenced[1].trim());
      if (fromFence) return fromFence;
    }

    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match?.[0]) {
      const fromBrace = tryParse(match[0]);
      if (fromBrace) return fromBrace;
    }

    // Attempt to close truncated JSON (common when output hits token limit)
    let repaired = cleaned;
    if (repaired.endsWith(',')) repaired = repaired.slice(0, -1);
    if (!repaired.endsWith('"') && !repaired.endsWith('}') && !repaired.endsWith(']')) {
      const lastQuote = repaired.lastIndexOf('"');
      if (lastQuote > 0) repaired = `${repaired.slice(0, lastQuote)}"`;
    }
    const openBraces = (repaired.match(/\{/g) ?? []).length - (repaired.match(/\}/g) ?? []).length;
    const openBrackets = (repaired.match(/\[/g) ?? []).length - (repaired.match(/\]/g) ?? []).length;
    for (let i = 0; i < openBrackets; i++) repaired += ']';
    for (let i = 0; i < openBraces; i++) repaired += '}';

    const fromRepair = tryParse(repaired);
    if (fromRepair) {
      this.logger.warn('TabularReview: recovered truncated JSON response');
      return fromRepair;
    }

    this.logger.warn(`TabularReview: failed to parse LLM JSON response (len=${raw.length})`);
    return PARSE_FALLBACK;
  }

  private normalizeRows(rows: Partial<TabularReviewRow>[]): TabularReviewRow[] {
    return rows.map((r) => ({
      clauseName: r.clauseName ?? 'Unknown clause',
      docAText: r.docAText ?? null,
      docBText: r.docBText ?? null,
      changeType: (['ADDED', 'REMOVED', 'MODIFIED', 'UNCHANGED'].includes(r.changeType as string)
        ? r.changeType
        : 'MODIFIED') as ChangeType,
      riskLevel: (['HIGH', 'MEDIUM', 'LOW', 'NONE', 'UNKNOWN'].includes(r.riskLevel as string)
        ? r.riskLevel
        : 'UNKNOWN') as RiskLevel,
      riskDetail: r.riskDetail ?? null,
      recommendation: r.recommendation ?? null,
    }));
  }

  async compareDocuments(input: {
    docAText: string;
    docBText: string;
    docAName?: string;
    docBName?: string;
    documentType?: string;
    countryCode?: string;
    aiModelMode?: 'AUTO' | 'PREMIUM';
    premiumModelId?: string;
  }): Promise<TabularReviewResult> {
    const docAName = input.docAName ?? 'Document A';
    const docBName = input.docBName ?? 'Document B';

    const truncated = (text: string, max = 40000) =>
      text.length > max ? text.slice(0, max) + '\n[... truncated ...]' : text;

    const userContent = `Compare these two ${input.documentType ?? 'legal documents'} for jurisdiction: ${input.countryCode ?? 'General'}.

--- ${docAName} ---
${truncated(input.docAText)}

--- ${docBName} ---
${truncated(input.docBText)}`;

    const autoModel =
      this.configService.get<string>('AI_MID_MODEL', '').trim() ||
      this.configService.get<string>('AI_LEGAL_STANDARD_MODEL', '').trim() ||
      'gpt-5.6-luna';

    const modelName =
      input.aiModelMode === 'PREMIUM' && input.premiumModelId
        ? normalizeModelId(input.premiumModelId)
        : autoModel;

    const messages = [
      { role: 'system' as const, content: TABULAR_SYSTEM_PROMPT },
      { role: 'user' as const, content: userContent },
    ];

    let response = await this.llm.complete({
      modelName,
      messages,
      temperature: 0.1,
      maxTokens: 16384,
    });

    let rawContent = response.content ?? '{}';
    let totalInputTokens = response.inputTokens ?? 0;
    let totalOutputTokens = response.outputTokens ?? 0;

    // Continue JSON if the model hit the output token limit mid-response
    let contCount = 0;
    while (isTruncated(response.finishReason) && contCount < 2) {
      this.logger.log(`TabularReview: output truncated (pass ${contCount + 1}), requesting continuation`);
      const cont = await this.llm.complete({
        modelName,
        messages: [
          ...messages,
          { role: 'assistant' as const, content: rawContent },
          {
            role: 'user' as const,
            content:
              'Your JSON response was cut off. Continue the JSON object exactly where you stopped. Do NOT repeat earlier rows. Close all arrays and objects validly.',
          },
        ],
        temperature: 0.1,
        maxTokens: 16384,
      });
      rawContent += cont.content ?? '';
      totalInputTokens += cont.inputTokens ?? 0;
      totalOutputTokens += cont.outputTokens ?? 0;
      response = cont;
      contCount++;
    }

    const parsed = this.parseTabularResponse(rawContent);
    const rows = this.normalizeRows(parsed.rows ?? []);

    if (rows.length === 0) {
      throw new BadRequestException(
        'Could not build a clause comparison table from the AI response. Try again, or paste shorter document excerpts.',
      );
    }

    const changed = rows.filter((r) => r.changeType !== 'UNCHANGED').length;
    const highRisk = rows.filter((r) => r.riskLevel === 'HIGH').length;
    const creditsUsed = Math.ceil((totalInputTokens + totalOutputTokens) / 1000);

    return {
      rows,
      summary: parsed.summary ?? 'Comparison complete.',
      totalClauses: rows.length,
      changedClauses: changed,
      highRiskClauses: highRisk,
      creditsUsed,
      modelName,
    };
  }
}
