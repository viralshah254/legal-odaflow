import { Injectable, Logger } from '@nestjs/common';
import { LlmCompletionService } from '@/ai/llm-completion.service';
import { DEFAULT_EXTRACT_MODEL } from '@/ai/model-costs.config';
import { DraftFactFidelityService } from './draft-fact-fidelity.service';

export interface StructuredDraftIntake {
  parties: Array<{ role: string; name: string; age?: string }>;
  conductSummary: string;
  dates: string[];
  locations: string[];
  channels: string[];
  forumIntent?: string;
  offenceDate?: string;
  missingFactQuestions: string[];
  thinFacts: boolean;
  approvedFactsJson: string;
}

/**
 * Phase 0 extract-then-draft: structured intake before prose generation
 * when facts are sparse. Uses nano (AI_LEGAL_EXTRACT_MODEL / DEFAULT_EXTRACT_MODEL).
 */
@Injectable()
export class DraftIntakeExtractionService {
  private readonly logger = new Logger(DraftIntakeExtractionService.name);

  constructor(
    private readonly llm: LlmCompletionService,
    private readonly factFidelity: DraftFactFidelityService,
  ) {}

  needsExtraction(caseDetails: string): boolean {
    return this.factFidelity.extractIntake(caseDetails).thinFacts;
  }

  async extract(input: {
    caseDetails: string;
    countryCode: string;
    documentKind?: string;
  }): Promise<StructuredDraftIntake> {
    const heuristic = this.factFidelity.extractIntake(input.caseDetails);
    if (!heuristic.thinFacts) {
      return this.fromHeuristic(input.caseDetails, heuristic);
    }

    const modelName = DEFAULT_EXTRACT_MODEL;

    try {
      const result = await this.llm.complete({
        modelName,
        messages: [
          {
            role: 'system',
            content:
              'Extract structured legal intake JSON from sparse user facts. ' +
              'Do NOT invent parties, dates, channels, or incidents. ' +
              'Output ONLY valid JSON with keys: parties (array of {role,name,age?}), ' +
              'conductSummary, dates, locations, channels, forumIntent, offenceDate, ' +
              'missingFactQuestions (array of strings).',
          },
          {
            role: 'user',
            content: `Country: ${input.countryCode}\nKind: ${input.documentKind ?? 'unknown'}\n\nFacts:\n${input.caseDetails}`,
          },
        ],
        maxTokens: 800,
        temperature: 0,
      });

      const parsed = this.parseJson(result.content);
      if (parsed) {
        const missingFactQuestions = Array.isArray(parsed.missingFactQuestions)
          ? parsed.missingFactQuestions.map(String)
          : this.defaultMissingQuestions(heuristic);
        const parties = Array.isArray(parsed.parties)
          ? (parsed.parties as Array<{ role?: string; name?: string; age?: string }>).map((p) => ({
              role: String(p.role ?? 'party'),
              name: String(p.name ?? ''),
              age: p.age ? String(p.age) : undefined,
            }))
          : [];
        const asStringArray = (v: unknown, fallback: string[]): string[] =>
          Array.isArray(v) ? v.map(String) : fallback;
        const approved = {
          parties,
          conductSummary: String(parsed.conductSummary ?? input.caseDetails.slice(0, 400)),
          dates: asStringArray(parsed.dates, heuristic.dates),
          locations: asStringArray(parsed.locations, []),
          channels: asStringArray(parsed.channels, heuristic.channels),
          forumIntent:
            typeof parsed.forumIntent === 'string' ? parsed.forumIntent : undefined,
          offenceDate:
            typeof parsed.offenceDate === 'string' ? parsed.offenceDate : undefined,
          missingFactQuestions,
        };
        return {
          ...approved,
          thinFacts: true,
          approvedFactsJson: JSON.stringify(approved, null, 2),
        };
      }
    } catch (err) {
      this.logger.warn(
        `Intake extraction LLM failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    return this.fromHeuristic(input.caseDetails, heuristic);
  }

  buildPromptBlock(intake: StructuredDraftIntake): string {
    return [
      'STRUCTURED INTAKE (approved facts only — draft from this JSON, do not invent):',
      intake.approvedFactsJson,
      intake.missingFactQuestions.length
        ? `Missing facts — use [BLANK: …] for: ${intake.missingFactQuestions.join('; ')}`
        : null,
      this.factFidelity.buildPromptBlock(intake.conductSummary),
    ]
      .filter(Boolean)
      .join('\n');
  }

  private fromHeuristic(
    caseDetails: string,
    heuristic: ReturnType<DraftFactFidelityService['extractIntake']>,
  ): StructuredDraftIntake {
    const approved = {
      parties: heuristic.parties.map((name) => ({ role: 'party', name })),
      conductSummary: caseDetails.trim(),
      dates: heuristic.dates,
      locations: heuristic.locations,
      channels: heuristic.channels,
      forumIntent: undefined as string | undefined,
      offenceDate: heuristic.dates[0],
      missingFactQuestions: heuristic.thinFacts
        ? this.defaultMissingQuestions(heuristic)
        : [],
    };
    return {
      ...approved,
      thinFacts: heuristic.thinFacts,
      approvedFactsJson: JSON.stringify(approved, null, 2),
    };
  }

  private defaultMissingQuestions(
    heuristic: ReturnType<DraftFactFidelityService['extractIntake']>,
  ): string[] {
    const q: string[] = [];
    if (heuristic.dates.length === 0) q.push('date/time of each incident');
    if (heuristic.locations.length === 0) q.push('location of incidents');
    if (heuristic.channels.length === 0) q.push('mode of contact (if any)');
    q.push('police station / court forum if known');
    return q;
  }

  private parseJson(content: string): Record<string, unknown> | null {
    const trimmed = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    try {
      return JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      const m = trimmed.match(/\{[\s\S]*\}/);
      if (!m) return null;
      try {
        return JSON.parse(m[0]) as Record<string, unknown>;
      } catch {
        return null;
      }
    }
  }
}
