import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LlmCompletionService } from '@/ai/llm-completion.service';
import { SECTION_FINDER_FALLBACK_MODEL } from '@/ai/legal-research/serious-model-lock';

export interface SectionFinderAiSuggestion {
  actId: string;
  actShort: string;
  section: string;
  title: string;
  confidence: 'low' | 'medium' | 'high';
  rationale: string;
  source: 'ai_suggest';
  /** Never Verified until corpus/connector confirms. */
  verificationState: 'ai_suggested';
}

export interface SectionFinderAiFallbackResult {
  query: string;
  countryCode: string;
  modelName: string;
  suggestions: SectionFinderAiSuggestion[];
}

@Injectable()
export class SectionFinderAiFallbackService {
  private readonly logger = new Logger(SectionFinderAiFallbackService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly llm: LlmCompletionService,
  ) {}

  private resolveModel(): string {
    return (
      this.configService.get<string>('AI_LEGAL_FAST_MODEL') ||
      this.configService.get<string>('AI_CHEAP_MODEL') ||
      SECTION_FINDER_FALLBACK_MODEL
    );
  }

  private normalizeSuggestions(
    raw: Array<Record<string, string>> | undefined,
  ): SectionFinderAiSuggestion[] {
    return (raw ?? [])
      .slice(0, 5)
      .map((s): SectionFinderAiSuggestion => {
        const confidence: SectionFinderAiSuggestion['confidence'] =
          s.confidence === 'high' || s.confidence === 'medium' ? s.confidence : 'low';
        return {
          actId: String(s.actId ?? 'unknown').toLowerCase(),
          actShort: String(s.actShort ?? s.actId ?? 'Unknown'),
          section: String(s.section ?? '').trim(),
          title: String(s.title ?? '').trim(),
          confidence,
          rationale: String(s.rationale ?? 'AI suggestion from query'),
          source: 'ai_suggest',
          verificationState: 'ai_suggested',
        };
      })
      .filter((s) => s.section.length > 0);
  }

  private async completeSuggestions(input: {
    query: string;
    countryCode: string;
    system: string;
    user: string;
  }): Promise<SectionFinderAiFallbackResult> {
    const countryCode = input.countryCode.toUpperCase();
    const modelName = this.resolveModel();

    try {
      const completion = await this.llm.complete({
        modelName,
        messages: [
          { role: 'system', content: input.system },
          { role: 'user', content: input.user },
        ],
        maxTokens: 800,
        temperature: 0.2,
      });
      const text = completion.content ?? '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return { query: input.query, countryCode, modelName, suggestions: [] };
      }
      const parsed = JSON.parse(jsonMatch[0]) as {
        suggestions?: Array<Record<string, string>>;
      };
      return {
        query: input.query,
        countryCode,
        modelName,
        suggestions: this.normalizeSuggestions(parsed.suggestions),
      };
    } catch (err) {
      this.logger.warn(
        `Section Finder AI fallback failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return { query: input.query, countryCode, modelName, suggestions: [] };
    }
  }

  /**
   * Cheap-model suggestions when deterministic Section Finder misses.
   * Results are AI-suggested / Unverified — never filing-safe alone.
   */
  async suggest(input: {
    query: string;
    countryCode: string;
    nearMisses?: Array<{ label: string; score?: number }>;
  }): Promise<SectionFinderAiFallbackResult> {
    const near =
      input.nearMisses?.slice(0, 5).map((m) => `- ${m.label}`).join('\n') ||
      '(none)';

    return this.completeSuggestions({
      query: input.query,
      countryCode: input.countryCode,
      system: [
        'You suggest likely statute sections when a legal Section Finder index miss occurs.',
        'Return ONLY JSON: {"suggestions":[{"actId":"","actShort":"","section":"","title":"","confidence":"low|medium|high","rationale":""}]}',
        'Max 5 suggestions. Prefer official short names (BNSS, IPC, Cap. 23, etc.).',
        'If unsure, use confidence "low". Do not invent long statutory text.',
      ].join(' '),
      user: [
        `Country: ${input.countryCode.toUpperCase()}`,
        `Query: ${input.query}`,
        `Near misses from index:`,
        near,
      ].join('\n'),
    });
  }

  /**
   * Intent-first candidate proposal for natural-language fact patterns.
   * Same shape as suggest(); callers must corpus-verify before treating as Verified.
   */
  async proposeCandidatesFromIntent(input: {
    query: string;
    countryCode: string;
    nearMisses?: Array<{ label: string; score?: number }>;
  }): Promise<SectionFinderAiFallbackResult> {
    const near =
      input.nearMisses?.slice(0, 5).map((m) => `- ${m.label}`).join('\n') ||
      '(none)';

    return this.completeSuggestions({
      query: input.query,
      countryCode: input.countryCode,
      system: [
        'You map a plain-language legal fact pattern to likely statute section candidates.',
        'Return ONLY JSON: {"suggestions":[{"actId":"","actShort":"","section":"","title":"","confidence":"low|medium|high","rationale":""}]}',
        'Max 5 candidates. Prefer current-code short names for India (BNS/BNSS/BSA) and Cap citations for Kenya.',
        'Propose actId + section numbers only — never invent long statutory text.',
        'If unsure, use confidence "low".',
      ].join(' '),
      user: [
        `Country: ${input.countryCode.toUpperCase()}`,
        `Fact pattern / query: ${input.query}`,
        `Optional near misses:`,
        near,
      ].join('\n'),
    });
  }
}
