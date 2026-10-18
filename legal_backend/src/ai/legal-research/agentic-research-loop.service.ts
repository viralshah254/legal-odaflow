import { Injectable, Logger } from '@nestjs/common';
import { LlmCompletionService } from '@/ai/llm-completion.service';
import type { RetrievedAuthority } from '@/legal-search/legal-retrieval.types';
import type {
  IssueCoverageMatrix,
  ResearchIntelligenceMap,
} from './research-intelligence-map.types';

export type ResearchHopPurpose = 'statute' | 'case' | 'current_law' | 'contrary' | 'background';

export interface ResearchHop {
  query: string;
  purpose: ResearchHopPurpose;
  /** Sub-issue this hop is meant to close, when the planner can attribute it. */
  issueId?: string;
  rationale: string;
  origin: 'planner' | 'coverage-matrix' | 'domain-checklist' | 'citation-graph';
}

export interface AssessCoverageInput {
  query: string;
  countryCode: string;
  jurisdiction?: string;
  map: ResearchIntelligenceMap;
  matrix: IssueCoverageMatrix;
  authorities: RetrievedAuthority[];
  /** Queries already issued in this run, so the planner does not repeat them. */
  attemptedQueries: string[];
  plannerModel: string;
  maxHops: number;
  /**
   * When false the planner LLM is skipped and only deterministic coverage gaps
   * drive the next hop — used on latency-sensitive modes.
   */
  consultPlanner: boolean;
}

export interface CoverageAssessment {
  /** True when the planner judges the evidence pack able to answer the exact question. */
  sufficient: boolean;
  /** Plain-language description of what is still missing, per sub-issue. */
  unresolved: string[];
  hops: ResearchHop[];
  /** Set when the planner could not be consulted; callers fall back to deterministic gaps. */
  degraded: boolean;
}

const CASE_NAME_RE =
  /\b([A-Z][A-Za-z.&'’()-]*(?:\s+(?:of|and|the|for|de|van|bin)?\s*[A-Z][A-Za-z.&'’()-]*){0,5})\s+(?:v\.?|vs\.?|versus)\s+([A-Z][A-Za-z.&'’()-]*(?:\s+(?:of|and|the|for|de|van|bin)?\s*[A-Z][A-Za-z.&'’()-]*){0,5})/g;

const CASE_NAME_NOISE = /\b(?:section|sections|article|articles|clause|rule|order|schedule|para|paragraph)\b/i;

/** Introductory words a judgment puts before a case name; not part of the party. */
const CITATION_SIGNAL_PREFIX =
  /^(?:See(?:\s+also)?|But\s+see|Cf|Compare|Accord|Citing|Cited|Quoting|Applying|Following|Distinguishing|Distinguished|Approving|Approved|Overruled|Relying\s+on|Referred\s+to|Referring\s+to|Held|Per|In|The)\s+/i;

/**
 * Drives the read-assess-replan half of research. Retrieval itself stays with the
 * orchestrator; this service decides whether what came back actually answers the
 * question and, if not, what to go and read next. Entirely jurisdiction-agnostic:
 * every jurisdictional signal comes from the caller's country/jurisdiction inputs.
 */
@Injectable()
export class AgenticResearchLoopService {
  private readonly logger = new Logger(AgenticResearchLoopService.name);

  constructor(private readonly llmCompletion: LlmCompletionService) {}

  /**
   * Reads the retrieved sources and decides whether research can stop.
   * Falls back to a non-degraded "keep going on the deterministic gaps" answer
   * whenever the planner model is unavailable.
   */
  async assessCoverage(input: AssessCoverageInput): Promise<CoverageAssessment> {
    const deterministicHops = this.coverageMatrixHops(input.matrix, input.attemptedQueries);

    if (input.maxHops <= 0) {
      return { sufficient: input.matrix.complete, unresolved: [], hops: [], degraded: false };
    }

    if (!input.consultPlanner) {
      return {
        sufficient: input.matrix.complete && deterministicHops.length === 0,
        unresolved: [],
        hops: deterministicHops.slice(0, input.maxHops),
        degraded: false,
      };
    }

    if (!this.llmCompletion.isModelConfigured(input.plannerModel)) {
      return {
        sufficient: input.matrix.complete,
        unresolved: [],
        hops: deterministicHops.slice(0, input.maxHops),
        degraded: true,
      };
    }

    const system = [
      'You are the research supervisor for a top-tier law firm, working in the jurisdiction named by the user.',
      'You have just read an evidence pack. Decide whether it is enough to answer the exact question asked,',
      'issue by issue, and if not, state precisely what must be read next.',
      'Rules:',
      '- Judge sufficiency against the question actually asked, not against a generic overview.',
      '- An issue is covered only if the pack contains the operative provision text or a judgment that decides it.',
      '- A summary that merely mentions a provision does not cover it.',
      '- Never invent case names, citations, or provisions. Next-step queries are search strings, not assertions.',
      '- Prefer queries that would reach primary sources in the stated jurisdiction.',
      '- Do not repeat queries that were already attempted.',
      'Respond with JSON only:',
      '{"sufficient":boolean,"unresolved":[string],"next":[{"query":string,"purpose":"statute"|"case"|"current_law"|"contrary"|"background","issueId":string|null,"rationale":string}]}',
    ].join('\n');

    const user = [
      `Jurisdiction: ${input.jurisdiction ?? input.countryCode} (country ${input.countryCode})`,
      `Question:\n${input.query}`,
      `\nSub-issues:\n${this.renderIssues(input.map, input.matrix)}`,
      `\nAlready attempted queries:\n${input.attemptedQueries.slice(0, 30).map((q) => `- ${q}`).join('\n') || '(none)'}`,
      `\nEvidence pack (what has actually been read):\n${this.renderAuthorities(input.authorities)}`,
      `\nReturn at most ${input.maxHops} next queries, ordered by how much they would change the answer.`,
    ].join('\n');

    try {
      const completion = await this.llmCompletion.complete({
        modelName: input.plannerModel,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0.1,
        maxTokens: 1200,
        reasoningEffort: 'medium',
      });

      const parsed = this.parseJson(completion.content);
      const issueIds = new Set(input.map.issues.map((i) => i.id));
      const attempted = new Set(input.attemptedQueries.map((q) => q.trim().toLowerCase()));

      const hops: ResearchHop[] = [];
      const rawNext = Array.isArray(parsed.next) ? parsed.next : [];
      for (const item of rawNext) {
        if (!item || typeof item !== 'object') continue;
        const record = item as Record<string, unknown>;
        const query = typeof record.query === 'string' ? record.query.trim() : '';
        if (query.length < 8) continue;
        if (attempted.has(query.toLowerCase())) continue;
        attempted.add(query.toLowerCase());
        const issueId = typeof record.issueId === 'string' ? record.issueId : undefined;
        hops.push({
          query,
          purpose: this.asPurpose(record.purpose),
          issueId: issueId && issueIds.has(issueId) ? issueId : undefined,
          rationale:
            typeof record.rationale === 'string' && record.rationale.trim()
              ? record.rationale.trim()
              : 'Planner-identified coverage gap.',
          origin: 'planner',
        });
      }

      // Deterministic gaps the planner did not cover still deserve a hop.
      for (const hop of deterministicHops) {
        if (hops.length >= input.maxHops) break;
        if (attempted.has(hop.query.toLowerCase())) continue;
        attempted.add(hop.query.toLowerCase());
        hops.push(hop);
      }

      const unresolved = (Array.isArray(parsed.unresolved) ? parsed.unresolved : [])
        .filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
        .map((u) => u.trim())
        .slice(0, 8);

      // The planner may only declare sufficiency when the deterministic matrix agrees.
      const sufficient = Boolean(parsed.sufficient) && hops.length === 0;

      return { sufficient, unresolved, hops: hops.slice(0, input.maxHops), degraded: false };
    } catch (err) {
      this.logger.warn(
        `Coverage assessment failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return {
        sufficient: input.matrix.complete,
        unresolved: [],
        hops: deterministicHops.slice(0, input.maxHops),
        degraded: true,
      };
    }
  }

  /**
   * Follows the citation graph outward: case names cited inside retrieved sources
   * that are not themselves in the pack become follow-up searches. This is how a
   * human researcher finds the line of authority rather than isolated hits.
   */
  citationGraphHops(
    authorities: RetrievedAuthority[],
    options: { attemptedQueries?: string[]; limit?: number; countryCode?: string } = {},
  ): ResearchHop[] {
    const limit = options.limit ?? 2;
    if (limit <= 0) return [];

    const attempted = new Set((options.attemptedQueries ?? []).map((q) => q.trim().toLowerCase()));
    const alreadyHeld = new Set(
      authorities
        .map((a) => this.normalizeCaseName(a.title ?? a.citation ?? ''))
        .filter((n) => n.length > 0),
    );

    const counts = new Map<string, { display: string; hits: number }>();
    for (const authority of authorities) {
      const text = authority.fullText ?? authority.summary ?? '';
      if (!text) continue;
      for (const match of text.slice(0, 40_000).matchAll(CASE_NAME_RE)) {
        let claimant = match[1].replace(/\s+/g, ' ').trim();
        while (CITATION_SIGNAL_PREFIX.test(claimant)) {
          claimant = claimant.replace(CITATION_SIGNAL_PREFIX, '').trim();
        }
        if (!claimant) continue;
        const display = `${claimant} v ${match[2]}`.replace(/\s+/g, ' ').trim();
        if (display.length > 120) continue;
        if (CASE_NAME_NOISE.test(display)) continue;
        const key = this.normalizeCaseName(display);
        if (!key || alreadyHeld.has(key)) continue;
        const existing = counts.get(key);
        if (existing) existing.hits += 1;
        else counts.set(key, { display, hits: 1 });
      }
    }

    return [...counts.values()]
      .sort((a, b) => b.hits - a.hits)
      .map(({ display, hits }) => ({
        query: `${display} judgment`,
        purpose: 'case' as const,
        rationale: `Cited ${hits} time(s) by sources already retrieved; read the source judgment rather than relying on a second-hand description.`,
        origin: 'citation-graph' as const,
      }))
      .filter((hop) => !attempted.has(hop.query.toLowerCase()))
      .slice(0, limit);
  }

  /** Turns unmet domain-checklist requirements into retrieval hops. */
  checklistHops(
    gaps: Array<{ id: string; label: string; retrievalTarget: string }>,
    options: { attemptedQueries?: string[]; limit?: number; query: string },
  ): ResearchHop[] {
    const limit = options.limit ?? 2;
    if (limit <= 0) return [];
    const attempted = new Set((options.attemptedQueries ?? []).map((q) => q.trim().toLowerCase()));

    return gaps
      .map((gap) => ({
        query: `${gap.label} ${options.query}`.slice(0, 240),
        purpose: 'background' as const,
        rationale: gap.retrievalTarget,
        origin: 'domain-checklist' as const,
      }))
      .filter((hop) => !attempted.has(hop.query.toLowerCase()))
      .slice(0, limit);
  }

  private coverageMatrixHops(matrix: IssueCoverageMatrix, attemptedQueries: string[]): ResearchHop[] {
    const attempted = new Set(attemptedQueries.map((q) => q.trim().toLowerCase()));
    const purposeByDimension: Record<string, ResearchHopPurpose> = {
      law: 'statute',
      cases: 'case',
      current: 'current_law',
      contrary: 'contrary',
    };

    const hops: ResearchHop[] = [];
    const seenIssues = new Map<string, number>();
    for (const cell of matrix.redCells) {
      if (cell.nonRetryable) continue;
      for (const query of cell.suggestedQueries) {
        const key = query.trim().toLowerCase();
        if (!key || attempted.has(key)) continue;
        // Spread hops across sub-issues instead of exhausting the budget on one.
        const used = seenIssues.get(cell.issueId) ?? 0;
        if (used >= 2) break;
        seenIssues.set(cell.issueId, used + 1);
        attempted.add(key);
        hops.push({
          query,
          purpose: purposeByDimension[cell.dimension] ?? 'background',
          issueId: cell.issueId,
          rationale: `Coverage matrix red cell: ${cell.dimension} for issue ${cell.issueId}.`,
          origin: 'coverage-matrix',
        });
      }
    }
    return hops;
  }

  private renderIssues(map: ResearchIntelligenceMap, matrix: IssueCoverageMatrix): string {
    if (map.issues.length === 0) return '(no sub-issues identified)';
    return map.issues
      .slice(0, 12)
      .map((issue) => {
        const cell = matrix.cells.find((c) => c.issueId === issue.id);
        const covered = cell
          ? (['law', 'cases', 'current', 'contrary'] as const)
              .map((d) => `${d}=${cell[d] ? 'yes' : 'NO'}`)
              .join(' ')
          : 'not assessed';
        return `- [${issue.id}] ${issue.label} (${covered})`;
      })
      .join('\n');
  }

  private renderAuthorities(authorities: RetrievedAuthority[]): string {
    if (authorities.length === 0) return '(nothing retrieved yet)';
    return authorities
      .slice(0, 25)
      .map((a, i) => {
        const cite = a.citation ?? a.title ?? a.id ?? `authority-${i + 1}`;
        const body = (a.fullText ?? a.summary ?? '').replace(/\s+/g, ' ').slice(0, 700);
        return `[${i + 1}] ${cite}\n${body || '(no text retrieved — reference only)'}`;
      })
      .join('\n\n');
  }

  private normalizeCaseName(value: string): string {
    return value
      .toLowerCase()
      .replace(/\b(?:v\.?|vs\.?|versus)\b/g, 'v')
      .replace(/[^a-z0-9 ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private asPurpose(value: unknown): ResearchHopPurpose {
    const allowed: ResearchHopPurpose[] = [
      'statute',
      'case',
      'current_law',
      'contrary',
      'background',
    ];
    return allowed.includes(value as ResearchHopPurpose)
      ? (value as ResearchHopPurpose)
      : 'background';
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
