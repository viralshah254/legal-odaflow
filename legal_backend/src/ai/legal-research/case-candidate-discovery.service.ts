import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LlmCompletionService } from '@/ai/llm-completion.service';

export interface CaseDiscoveryCandidate {
  title: string;
  citation?: string | null;
  court?: string | null;
  doctrine?: string | null;
  searchPhrase?: string | null;
  confidence?: 'high' | 'medium' | 'low';
  note?: string | null;
}

export interface CaseDiscoveryPlan {
  modelName: string;
  degraded: boolean;
  degradationReason?: string;
  candidates: CaseDiscoveryCandidate[];
  alternateSearchPhrases: string[];
}

const DISCOVERY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    candidates: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string' },
          citation: { type: ['string', 'null'] },
          court: { type: ['string', 'null'] },
          doctrine: { type: ['string', 'null'] },
          searchPhrase: { type: ['string', 'null'] },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
          note: { type: ['string', 'null'] },
        },
        required: ['title', 'citation', 'court', 'doctrine', 'searchPhrase', 'confidence', 'note'],
      },
    },
    alternateSearchPhrases: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: ['candidates', 'alternateSearchPhrases'],
} as const;

@Injectable()
export class CaseCandidateDiscoveryService {
  private readonly logger = new Logger(CaseCandidateDiscoveryService.name);

  constructor(
    private readonly llm: LlmCompletionService,
    private readonly config: ConfigService,
  ) {}

  async planCandidates(input: {
    query: string;
    countryCode: string;
    jurisdiction?: string;
    legalDomain?: string;
  }): Promise<CaseDiscoveryPlan> {
    const modelName =
      this.config.get<string>('AI_LEGAL_COMPLEX_MODEL', 'gpt-5.6-sol') ?? 'gpt-5.6-sol';

    const system = [
      'You are a global legal research planner for case-law retrieval.',
      'Return ONLY structured JSON matching the schema.',
      'Suggest well-known judgments from the stated jurisdiction that may answer the query.',
      'Use model knowledge as CANDIDATES for retrieval — not as verified holdings.',
      'Do NOT invent reporter volume/page citations. If unsure of the exact reporter cite, set citation to null and provide a precise searchPhrase instead.',
      'Prefer apex-court and reported citations when confident for that jurisdiction.',
      'For India: include partnership-deed / arbitration / consumer / cyber-fraud / credit-reporting cases when relevant.',
      'For US/KE/GB/other: use local leading authorities and local citation practice.',
    ].join(' ');

    const user = [
      `Country: ${input.countryCode}`,
      input.jurisdiction ? `Jurisdiction hint: ${input.jurisdiction}` : '',
      input.legalDomain ? `Legal domain: ${input.legalDomain}` : '',
      `Research query: ${input.query}`,
      'Provide up to 8 candidate cases and up to 6 alternate search phrases for database lookup.',
    ]
      .filter(Boolean)
      .join('\n');

    try {
      const result = await this.llm.complete({
        modelName,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        responseFormat: {
          type: 'json_schema',
          json_schema: {
            name: 'case_discovery_plan',
            strict: true,
            schema: DISCOVERY_SCHEMA as unknown as Record<string, unknown>,
          },
        },
        maxTokens: 1800,
        reasoningEffort: 'high',
      });

      const parsed = JSON.parse(result.content) as {
        candidates?: CaseDiscoveryCandidate[];
        alternateSearchPhrases?: string[];
      };

      return {
        modelName: result.modelName,
        degraded: false,
        candidates: (parsed.candidates ?? []).slice(0, 8),
        alternateSearchPhrases: (parsed.alternateSearchPhrases ?? []).slice(0, 6),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Case candidate discovery failed on ${modelName}: ${message}`);
      return {
        modelName,
        degraded: true,
        degradationReason: message,
        candidates: [],
        alternateSearchPhrases: [],
      };
    }
  }
}
