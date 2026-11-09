import { Injectable, Logger } from '@nestjs/common';
import { LlmCompletionService } from '@/ai/llm-completion.service';
import { DRAFT_CITATION_PATTERNS } from './draft-citation-sanitizer';

export type CoherenceCategory =
  | 'parties'
  | 'dates'
  | 'chronology'
  | 'relief_vs_grounds'
  | 'internal_contradiction'
  | 'narrative'
  | 'omission';

export interface CoherenceIssue {
  severity: 'BLOCKER' | 'HIGH' | 'MEDIUM' | 'LOW';
  category: CoherenceCategory;
  explanation: string;
  suggestedFix?: string;
}

export interface CoherenceReviewResult {
  issues: CoherenceIssue[];
  /** Revised text, only when the revision introduced no new citation and no new party or date. */
  revisedDraft?: string;
  /** Set when a revision was produced but rejected because it added unverifiable content. */
  revisionRejectedReason?: string;
  /** True when the review could not run; callers must not treat this as a clean bill. */
  degraded: boolean;
}

export interface CoherenceReviewInput {
  draft: string;
  documentKind: string;
  countryCode?: string;
  jurisdiction?: string;
  /** Optional context so the reviewer knows what the filing was meant to argue. */
  caseTheoryPromptBlock?: string;
  model: string;
  /** Only filing-grade documents pay for the rewrite half of the pass. */
  allowRevision: boolean;
}

const DATE_RE = /\b(?:\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|\d{4}-\d{2}-\d{2}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?,?\s+\d{4})\b/gi;

/**
 * The read a supervising partner gives a filing before it goes out: does it hold
 * together as one document — same parties throughout, a chronology that runs in
 * order, relief that actually follows from the grounds pleaded, no paragraph
 * contradicting another.
 *
 * The reviewer may tighten the document, but a revision is accepted only if it
 * adds no citation, party, or date that was not already there. Coherence must
 * never become a back door for new unverified content.
 */
@Injectable()
export class DraftCoherenceReviewService {
  private readonly logger = new Logger(DraftCoherenceReviewService.name);

  constructor(private readonly llm: LlmCompletionService) {}

  async review(input: CoherenceReviewInput): Promise<CoherenceReviewResult> {
    if (!input.draft.trim() || !this.llm.isModelConfigured(input.model)) {
      return { issues: [], degraded: true };
    }

    const jurisdictionLabel = input.jurisdiction ?? input.countryCode ?? 'the governing jurisdiction';
    const system = [
      `You are the supervising partner giving a ${input.documentKind} its final read before filing in ${jurisdictionLabel}.`,
      'Read the whole document as one piece and report where it fails to hold together:',
      '- parties named inconsistently, or a party who appears without being introduced',
      '- dates that conflict, or a chronology that does not run in order',
      '- relief sought that does not follow from the grounds pleaded, or a ground that leads nowhere',
      '- paragraphs that contradict each other',
      '- a section that reads as though it belongs to a different matter',
      'Rules for any revision you propose:',
      '- You may reorder, reword, and reconcile. You may NOT add a case citation, statute reference, party, date, or fact that is not already in the document.',
      '- Never delete an [AUTHORITY GAP] marker or a caveat about unverified material.',
      '- If nothing needs changing, return the document unchanged.',
      'Respond with JSON only:',
      '{"issues":[{"severity":"BLOCKER"|"HIGH"|"MEDIUM"|"LOW","category":"parties"|"dates"|"chronology"|"relief_vs_grounds"|"internal_contradiction"|"narrative"|"omission","explanation":string,"suggestedFix":string}]' +
        (input.allowRevision ? ',"revisedDraft":string}' : '}'),
    ].join('\n');

    const user = [
      input.caseTheoryPromptBlock ? `${input.caseTheoryPromptBlock}\n` : '',
      'Document under review:',
      input.draft.slice(0, 60_000),
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
        temperature: 0.1,
        maxTokens: input.allowRevision ? 16_000 : 6000,
        responseFormat: { type: 'json_object' },
        timeoutMs: 30_000,
        reasoningEffort: input.allowRevision ? 'high' : 'medium',
      });

      const parsed = this.parseJson(completion.content);
      const issues = this.readIssues(parsed.issues);

      if (!input.allowRevision) return { issues, degraded: false };

      const candidate = typeof parsed.revisedDraft === 'string' ? parsed.revisedDraft.trim() : '';
      if (!candidate || candidate === input.draft.trim()) {
        return { issues, degraded: false };
      }

      const rejection = this.rejectionReason(input.draft, candidate);
      if (rejection) {
        this.logger.warn(`Coherence revision rejected: ${rejection}`);
        return { issues, revisionRejectedReason: rejection, degraded: false };
      }

      return { issues, revisedDraft: candidate, degraded: false };
    } catch (err) {
      this.logger.warn(
        `Coherence review failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return { issues: [], degraded: true };
    }
  }

  /**
   * A revision may only reconcile what is already there. Anything the reviewer
   * added that looks like a citation, a date, or a dropped gap marker is treated
   * as new unverified content and the whole revision is discarded.
   */
  private rejectionReason(original: string, revised: string): string | undefined {
    const originalCitations = this.citationSet(original);
    for (const citation of this.citationSet(revised)) {
      if (!originalCitations.has(citation)) return `revision introduced a new citation (${citation})`;
    }

    const originalDates = new Set((original.match(DATE_RE) ?? []).map((d) => d.toLowerCase()));
    for (const date of revised.match(DATE_RE) ?? []) {
      if (!originalDates.has(date.toLowerCase())) return `revision introduced a new date (${date})`;
    }

    const originalGaps = (original.match(/\[AUTHORITY GAP\]/g) ?? []).length;
    const revisedGaps = (revised.match(/\[AUTHORITY GAP\]/g) ?? []).length;
    if (revisedGaps < originalGaps) return 'revision removed an authority-gap marker';

    if (revised.length < original.length * 0.6) return 'revision dropped more than 40% of the filing';

    return undefined;
  }

  private citationSet(text: string): Set<string> {
    const found = new Set<string>();
    for (const pattern of DRAFT_CITATION_PATTERNS) {
      const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
      for (const match of text.matchAll(re)) {
        found.add(match[0].replace(/\s+/g, ' ').trim().toLowerCase());
      }
    }
    return found;
  }

  private readIssues(value: unknown): CoherenceIssue[] {
    if (!Array.isArray(value)) return [];
    const severities: CoherenceIssue['severity'][] = ['BLOCKER', 'HIGH', 'MEDIUM', 'LOW'];
    const categories: CoherenceCategory[] = [
      'parties',
      'dates',
      'chronology',
      'relief_vs_grounds',
      'internal_contradiction',
      'narrative',
      'omission',
    ];

    return value
      .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
      .map((item) => ({
        severity: severities.includes(item.severity as CoherenceIssue['severity'])
          ? (item.severity as CoherenceIssue['severity'])
          : 'MEDIUM',
        category: categories.includes(item.category as CoherenceCategory)
          ? (item.category as CoherenceCategory)
          : 'narrative',
        explanation: String(item.explanation ?? '').trim(),
        suggestedFix:
          typeof item.suggestedFix === 'string' && item.suggestedFix.trim()
            ? item.suggestedFix.trim()
            : undefined,
      }))
      .filter((issue) => issue.explanation.length > 0)
      .slice(0, 25);
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
