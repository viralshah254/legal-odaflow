import { Injectable, Logger } from '@nestjs/common';
import { LlmCompletionService } from '@/ai/llm-completion.service';
import type { DraftCaseBrief } from './draft-case-brief.types';

export interface CaseTheoryIssue {
  id: string;
  label: string;
  /** The elements/ingredients that must be established for this issue. */
  elements: string[];
}

export interface CaseTheoryGround {
  id: string;
  label: string;
  issueId?: string;
  /** Facts from the matter that this ground rests on. */
  supportingFacts: string[];
  /** What kind of authority would establish this ground — drives targeted retrieval. */
  authorityNeed: string;
}

export interface CaseTheoryRebuttal {
  argument: string;
  response: string;
}

export interface DraftCaseTheory {
  thesis: string;
  issues: CaseTheoryIssue[];
  grounds: CaseTheoryGround[];
  favourableFacts: string[];
  weaknesses: string[];
  adversaryArguments: string[];
  rebuttals: CaseTheoryRebuttal[];
  reliefStrategy: string;
  /** True when the model could not be consulted and the theory is brief-derived only. */
  degraded: boolean;
}

export interface BuildCaseTheoryInput {
  facts: string;
  documentKind: string;
  countryCode?: string;
  jurisdiction?: string;
  caseBrief?: DraftCaseBrief | null;
  model: string;
  /** Only filing-grade pleadings pay for the LLM pass; others get the brief-derived theory. */
  filingGrade: boolean;
}

/**
 * Produces the strategy artifact a senior lawyer writes before drafting: what the
 * case is really about, which elements must be met, which facts carry each ground,
 * what the other side will say, and how it is answered.
 *
 * It reasons about strategy only. It never asserts law or names authorities — the
 * `authorityNeed` field describes what to go and find, and retrieval/verification
 * decide whether such an authority actually exists.
 */
@Injectable()
export class DraftCaseTheoryService {
  private readonly logger = new Logger(DraftCaseTheoryService.name);

  constructor(private readonly llm: LlmCompletionService) {}

  async build(input: BuildCaseTheoryInput): Promise<DraftCaseTheory> {
    const fallback = this.fromBrief(input);

    if (!input.filingGrade || !this.llm.isModelConfigured(input.model)) {
      return fallback;
    }

    const jurisdictionLabel = input.jurisdiction ?? input.countryCode ?? 'the governing jurisdiction';
    const system = [
      `You are the supervising partner settling the strategy for a ${input.documentKind} to be filed in ${jurisdictionLabel}.`,
      'Before a word is drafted you set out the theory of the case.',
      'Rules:',
      '- Work only from the facts given. Never invent facts, parties, dates, case names, or citations.',
      '- Name no authorities. For each ground, describe in words what authority would establish it; someone else will search for it.',
      '- State elements as the governing jurisdiction frames them; if you are unsure of the local framing, describe the element functionally.',
      '- Be adversarial with your own case: weaknesses and the opponent\'s best arguments must be real, not strawmen.',
      'Respond with JSON only:',
      '{"thesis":string,"issues":[{"id":string,"label":string,"elements":[string]}],',
      '"grounds":[{"id":string,"label":string,"issueId":string|null,"supportingFacts":[string],"authorityNeed":string}],',
      '"favourableFacts":[string],"weaknesses":[string],"adversaryArguments":[string],',
      '"rebuttals":[{"argument":string,"response":string}],"reliefStrategy":string}',
    ].join('\n');

    const user = [
      `Document to be drafted: ${input.documentKind}`,
      `Jurisdiction: ${jurisdictionLabel}`,
      input.caseBrief ? `\nStructured brief:\n${this.renderBrief(input.caseBrief)}` : '',
      `\nMatter facts as given by the instructing lawyer:\n${input.facts.slice(0, 20_000)}`,
    ]
      .filter(Boolean)
      .join('\n');

    try {
      const completion = await this.llm.complete({
        modelName: input.model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0.2,
        maxTokens: 2500,
        reasoningEffort: 'high',
      });

      const parsed = this.parseJson(completion.content);
      const issues = this.readIssues(parsed.issues);
      const grounds = this.readGrounds(parsed.grounds, new Set(issues.map((i) => i.id)));

      if (!parsed.thesis && issues.length === 0 && grounds.length === 0) return fallback;

      return {
        thesis: this.readString(parsed.thesis) || fallback.thesis,
        issues: issues.length > 0 ? issues : fallback.issues,
        grounds: grounds.length > 0 ? grounds : fallback.grounds,
        favourableFacts: this.readStringList(parsed.favourableFacts, 12),
        weaknesses: this.readStringList(parsed.weaknesses, 12),
        adversaryArguments: this.readStringList(parsed.adversaryArguments, 12),
        rebuttals: this.readRebuttals(parsed.rebuttals),
        reliefStrategy: this.readString(parsed.reliefStrategy),
        degraded: false,
      };
    } catch (err) {
      this.logger.warn(
        `Case theory generation failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return fallback;
    }
  }

  /** Retrieval queries aimed at each ground, so authority search is per-ground, not generic. */
  buildAuthorityQueries(
    theory: DraftCaseTheory,
    options: { documentKind: string; jurisdiction?: string; limit?: number },
  ): string[] {
    const limit = options.limit ?? 6;
    const jurisdiction = options.jurisdiction ? ` ${options.jurisdiction}` : '';
    const seen = new Set<string>();
    const queries: string[] = [];

    const push = (raw: string) => {
      const query = raw.replace(/\s+/g, ' ').trim().slice(0, 220);
      if (query.length < 10) return;
      const key = query.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      queries.push(query);
    };

    for (const ground of theory.grounds) {
      push(`${ground.authorityNeed || ground.label}${jurisdiction}`);
    }
    for (const issue of theory.issues) {
      push(`${issue.label}${jurisdiction} legal test`);
    }

    return queries.slice(0, limit);
  }

  buildPromptBlock(theory: DraftCaseTheory): string {
    const lines: string[] = ['THEORY OF THE CASE (settled before drafting — follow it):'];
    if (theory.thesis) lines.push(`Thesis: ${theory.thesis}`);

    if (theory.issues.length > 0) {
      lines.push('Issues and the elements that must be established:');
      for (const issue of theory.issues) {
        lines.push(`- [${issue.id}] ${issue.label}`);
        for (const element of issue.elements) lines.push(`    * ${element}`);
      }
    }

    if (theory.grounds.length > 0) {
      lines.push('Grounds to plead, and the facts each rests on:');
      for (const ground of theory.grounds) {
        lines.push(
          `- [${ground.id}] ${ground.label}${ground.issueId ? ` (issue ${ground.issueId})` : ''}`,
        );
        for (const fact of ground.supportingFacts) lines.push(`    * fact: ${fact}`);
      }
    }

    if (theory.favourableFacts.length > 0) {
      lines.push(`Facts to lead with: ${theory.favourableFacts.join('; ')}`);
    }
    if (theory.weaknesses.length > 0) {
      lines.push(`Known weaknesses to address rather than hide: ${theory.weaknesses.join('; ')}`);
    }
    if (theory.rebuttals.length > 0) {
      lines.push('Anticipated opposition and our answer:');
      for (const rebuttal of theory.rebuttals) {
        lines.push(`- They will say: ${rebuttal.argument}`);
        lines.push(`  We answer: ${rebuttal.response}`);
      }
    } else if (theory.adversaryArguments.length > 0) {
      lines.push(`Anticipated opposition: ${theory.adversaryArguments.join('; ')}`);
    }
    if (theory.reliefStrategy) lines.push(`Relief strategy: ${theory.reliefStrategy}`);

    lines.push(
      'This theory sets strategy only. Cite no authority unless it appears in the verified sources supplied to you.',
    );

    return lines.join('\n');
  }

  /** Brief-derived theory: always available, never blocks drafting when the LLM is down. */
  private fromBrief(input: BuildCaseTheoryInput): DraftCaseTheory {
    const brief = input.caseBrief;
    const grounds = (brief?.requiredGrounds ?? []).map((label, index) => ({
      id: `ground-${index + 1}`,
      label,
      supportingFacts: [],
      authorityNeed: label,
    }));

    return {
      thesis: brief?.rawSummary?.slice(0, 500) ?? '',
      issues: [],
      grounds,
      favourableFacts: brief?.defenceFacts ?? [],
      weaknesses: brief?.contradictions ?? [],
      adversaryArguments: brief?.prosecutionFacts ?? [],
      rebuttals: [],
      reliefStrategy: '',
      degraded: true,
    };
  }

  private renderBrief(brief: DraftCaseBrief): string {
    const lines: string[] = [];
    if (brief.parties.length > 0) {
      lines.push(`Parties: ${brief.parties.map((p) => `${p.name} (${p.role})`).join(', ')}`);
    }
    if (brief.proceduralStage) lines.push(`Procedural stage: ${brief.proceduralStage}`);
    if (brief.prosecutionFacts.length > 0) {
      lines.push(`Opposing case: ${brief.prosecutionFacts.join('; ')}`);
    }
    if (brief.defenceFacts.length > 0) lines.push(`Our facts: ${brief.defenceFacts.join('; ')}`);
    if (brief.contradictions.length > 0) {
      lines.push(`Contradictions: ${brief.contradictions.join('; ')}`);
    }
    if (brief.citedOffences.length > 0) {
      lines.push(`Provisions in play: ${brief.citedOffences.map((o) => o.raw).join(', ')}`);
    }
    return lines.join('\n');
  }

  private readIssues(value: unknown): CaseTheoryIssue[] {
    if (!Array.isArray(value)) return [];
    return value
      .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
      .map((item, index) => ({
        id: this.readString(item.id) || `issue-${index + 1}`,
        label: this.readString(item.label),
        elements: this.readStringList(item.elements, 10),
      }))
      .filter((issue) => issue.label.length > 0)
      .slice(0, 10);
  }

  private readGrounds(value: unknown, issueIds: Set<string>): CaseTheoryGround[] {
    if (!Array.isArray(value)) return [];
    return value
      .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
      .map((item, index) => {
        const issueId = this.readString(item.issueId);
        return {
          id: this.readString(item.id) || `ground-${index + 1}`,
          label: this.readString(item.label),
          issueId: issueId && issueIds.has(issueId) ? issueId : undefined,
          supportingFacts: this.readStringList(item.supportingFacts, 8),
          authorityNeed: this.readString(item.authorityNeed),
        };
      })
      .filter((ground) => ground.label.length > 0)
      .slice(0, 15);
  }

  private readRebuttals(value: unknown): CaseTheoryRebuttal[] {
    if (!Array.isArray(value)) return [];
    return value
      .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
      .map((item) => ({
        argument: this.readString(item.argument),
        response: this.readString(item.response),
      }))
      .filter((rebuttal) => rebuttal.argument.length > 0 && rebuttal.response.length > 0)
      .slice(0, 10);
  }

  private readString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private readStringList(value: unknown, limit: number): string[] {
    if (!Array.isArray(value)) return [];
    return value
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .map((item) => item.trim())
      .slice(0, limit);
  }

  private parseJson(content: string): Record<string, unknown> {
    const trimmed = content.trim();
    const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
    const raw = fence?.[1]?.trim() ?? trimmed;
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    const candidate = start >= 0 && end > start ? raw.slice(start, end + 1) : raw;
    const parsed: unknown = JSON.parse(candidate);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  }
}
