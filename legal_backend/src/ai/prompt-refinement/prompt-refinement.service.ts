import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LlmCompletionService } from '@/ai/llm-completion.service';
import { DEFAULT_EXTRACT_MODEL } from '@/ai/model-costs.config';
import {
  PROMPT_REFINE_LLM_INPUT_MAX_LENGTH,
  PROMPT_REFINE_OUTPUT_MAX_LENGTH,
} from './dto/refine-prompt.dto';
import type {
  LlmRefinementPayload,
  PromptRefinementSkipReason,
  RefinePromptInput,
  RefinePromptResult,
} from './prompt-refinement.types';

export const PROMPT_REFINE_MIN_LENGTH = 20;

const LABELED_SECTION_PATTERN =
  /(?:^|\n)\s*(?:legal\s+question|research\s+question|question|facts|key\s+facts|parties|background|relief\s+sought|document\s+type|jurisdiction|forum)\s*:/i;

const BULLET_FACTS_PATTERN = /(?:^|\n)\s*[-*•]\s+.+/m;

const RESEARCH_SYSTEM_PROMPT = `You rewrite messy legal research questions into a clear, structured prompt for an AI legal research system.

Return ONLY valid JSON (no markdown fences). Schema:
{
  "refinedPrompt": string,
  "hints": {
    "jurisdiction": string|null,
    "documentKind": string|null,
    "parties": string[],
    "statutes": string[]
  }
}

Structure refinedPrompt as:
1. One clear legal question (single paragraph or sentence ending with ?)
2. Key facts as bullet points (parties, dates, forum, amounts — only if user mentioned them)
3. Optional: jurisdiction/statute references if present in the user text
4. Optional: what the user wants (rule, case law, procedure, draft language)

Rules:
- Do NOT invent facts, parties, amounts, dates, statutes, or legal conclusions
- Preserve every detail the user provided; only reorganize, clarify ambiguity, fix grammar
- Keep refinedPrompt at most ~30% longer than the original
- hints must only contain information explicitly present or strongly implied in the user text
- Use null for unknown hint fields; empty arrays when none mentioned`;

const DRAFTING_SYSTEM_PROMPT = `You rewrite messy legal drafting requests into a clear, structured prompt for an AI document drafting system.

Return ONLY valid JSON (no markdown fences). Schema:
{
  "refinedPrompt": string,
  "hints": {
    "jurisdiction": string|null,
    "documentKind": string|null,
    "parties": string[],
    "statutes": string[]
  }
}

Structure refinedPrompt with labeled sections when helpful:
- Document sought
- Parties and roles
- Forum / jurisdiction
- Facts (chronological bullets)
- Relief or outcome requested
- Referenced existing documents

Rules:
- Do NOT invent facts, parties, amounts, dates, statutes, or legal conclusions
- Preserve every detail the user provided; only reorganize, clarify ambiguity, fix grammar
- Keep refinedPrompt at most ~30% longer than the original
- hints must only contain information explicitly present or strongly implied in the user text
- Use null for unknown hint fields; empty arrays when none mentioned`;

export function isPromptRefinementEnabled(flag: string | undefined): boolean {
  return flag === 'true';
}

/** Heuristic: prompt is already structured enough to skip LLM refinement. */
export function isAlreadyClearPrompt(prompt: string): boolean {
  const trimmed = prompt.trim();
  if (trimmed.length < 40) return false;

  const hasLabeledSections = LABELED_SECTION_PATTERN.test(trimmed);
  const bulletLines = trimmed.match(/(?:^|\n)\s*[-*•]\s+.+/gm) ?? [];
  const hasQuestion = /\?\s*$/.test(trimmed.split('\n')[0]?.trim() ?? '') || /\?\s/.test(trimmed);

  if (hasLabeledSections && bulletLines.length >= 2) return true;
  if (hasQuestion && bulletLines.length >= 2 && BULLET_FACTS_PATTERN.test(trimmed)) return true;
  // Long fact patterns (common in research/drafting paste) — no need to restructure
  if (bulletLines.length >= 4 && trimmed.length >= 500) return true;

  return false;
}

export function buildSkipResult(
  originalPrompt: string,
  skipReason: PromptRefinementSkipReason,
): RefinePromptResult {
  return {
    originalPrompt,
    refinedPrompt: originalPrompt,
    skipped: true,
    skipReason,
  };
}

function buildContextBlock(input: RefinePromptInput): string {
  const lines: string[] = [];
  if (input.countryCode) lines.push(`Country: ${input.countryCode}`);
  if (input.jurisdiction) lines.push(`Jurisdiction: ${input.jurisdiction}`);
  if (input.practiceArea) lines.push(`Practice area: ${input.practiceArea}`);
  if (input.outputLanguage) lines.push(`Output language: ${input.outputLanguage}`);
  if (input.knowledgeSources?.length) {
    lines.push(`Knowledge sources: ${input.knowledgeSources.join(', ')}`);
  }
  return lines.length ? `\n\nUI context (use only if consistent with user text):\n${lines.join('\n')}` : '';
}

function sanitizeHints(hints: LlmRefinementPayload['hints'] | undefined): RefinePromptResult['hints'] {
  if (!hints) return undefined;
  const out: NonNullable<RefinePromptResult['hints']> = {};
  if (hints.jurisdiction?.trim()) out.jurisdiction = hints.jurisdiction.trim().slice(0, 64);
  if (hints.documentKind?.trim()) out.documentKind = hints.documentKind.trim().slice(0, 80);
  if (Array.isArray(hints.parties)) {
    const parties = hints.parties.map((p) => String(p).trim()).filter(Boolean).slice(0, 8);
    if (parties.length) out.parties = parties;
  }
  if (Array.isArray(hints.statutes)) {
    const statutes = hints.statutes.map((s) => String(s).trim()).filter(Boolean).slice(0, 8);
    if (statutes.length) out.statutes = statutes;
  }
  return Object.keys(out).length ? out : undefined;
}

function parseLlmPayload(raw: string): LlmRefinementPayload | null {
  const cleaned = raw.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim();
  try {
    return JSON.parse(cleaned) as LlmRefinementPayload;
  } catch {
    return null;
  }
}

@Injectable()
export class PromptRefinementService implements OnModuleInit {
  private readonly logger = new Logger(PromptRefinementService.name);

  constructor(
    private readonly llm: LlmCompletionService,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit(): void {
    const enabled = isPromptRefinementEnabled(this.configService.get<string>('ENABLE_PROMPT_REFINEMENT'));
    this.logger.log(`Prompt refinement ${enabled ? 'enabled' : 'disabled'} (ENABLE_PROMPT_REFINEMENT=${this.configService.get<string>('ENABLE_PROMPT_REFINEMENT') ?? 'unset'})`);
  }

  async refine(input: RefinePromptInput): Promise<RefinePromptResult> {
    const originalPrompt = input.prompt.trim();

    if (!isPromptRefinementEnabled(this.configService.get<string>('ENABLE_PROMPT_REFINEMENT'))) {
      return buildSkipResult(originalPrompt, 'disabled');
    }

    if (originalPrompt.length < PROMPT_REFINE_MIN_LENGTH) {
      return buildSkipResult(originalPrompt, 'too_short');
    }

    if (isAlreadyClearPrompt(originalPrompt)) {
      return buildSkipResult(originalPrompt, 'already_clear');
    }

    if (originalPrompt.length > PROMPT_REFINE_LLM_INPUT_MAX_LENGTH) {
      return buildSkipResult(originalPrompt, 'too_long');
    }

    try {
      const systemPrompt = input.purpose === 'research' ? RESEARCH_SYSTEM_PROMPT : DRAFTING_SYSTEM_PROMPT;
      const userContent = `${originalPrompt.slice(0, PROMPT_REFINE_LLM_INPUT_MAX_LENGTH)}${buildContextBlock(input)}`;
      const maxOutputTokens = Math.min(900, Math.ceil(originalPrompt.length * 0.5) + 200);

      const result = await this.llm.complete({
        modelName: this.configService.get<string>('AI_PROMPT_REFINE_MODEL', DEFAULT_EXTRACT_MODEL),
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        maxTokens: maxOutputTokens,
        temperature: 0,
      });

      const payload = parseLlmPayload(result.content);
      const refined = payload?.refinedPrompt?.trim();

      if (!refined || refined.length < 3) {
        this.logger.warn('Prompt refinement returned empty refinedPrompt');
        return buildSkipResult(originalPrompt, 'llm_failed');
      }

      // If LLM returned essentially the same text, skip preview on client
      const normalizedOriginal = originalPrompt.replace(/\s+/g, ' ').toLowerCase();
      const normalizedRefined = refined.replace(/\s+/g, ' ').toLowerCase();
      if (normalizedOriginal === normalizedRefined) {
        return buildSkipResult(originalPrompt, 'already_clear');
      }

      return {
        originalPrompt,
        refinedPrompt: refined.slice(0, PROMPT_REFINE_OUTPUT_MAX_LENGTH),
        skipped: false,
        hints: sanitizeHints(payload?.hints),
      };
    } catch (err) {
      this.logger.warn(`Prompt refinement failed: ${err instanceof Error ? err.message : String(err)}`);
      return buildSkipResult(originalPrompt, 'llm_failed');
    }
  }
}
