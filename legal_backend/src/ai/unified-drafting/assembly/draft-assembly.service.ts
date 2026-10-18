import { Injectable, Logger } from '@nestjs/common';
import type { DraftExecutionPlan } from '../contracts/draft-execution-plan';
import type { VerifiedSource, VerifiedSourceRegistry } from '../contracts/verified-source';

export interface AssembleInput {
  jobId: string;
  sections: Array<{ sectionKey: string; sectionType: string; title: string; content: string; status: string }>;
  sourceRegistry: VerifiedSourceRegistry;
  executionPlan: DraftExecutionPlan;
}

export interface AssembledDraft {
  jobId: string;
  fullText: string;
  citationAppendix: CitationEntry[];
  sectionSummary: Array<{ sectionKey: string; title: string; status: string; wordCount: number }>;
  assembledAt: string;
  totalWordCount: number;
}

interface CitationEntry {
  id: string;
  title: string;
  citation?: string;
  section?: string;
  court?: string;
  type: string;
  bindingLevel?: string;
}

/** Bracketed source IDs the model may emit instead of human-readable citations. */
const SOURCE_REF_RE =
  /\[(curated__[\w]+|SOURCE_\w+|STATUTE_\w+|CASE_\w+|RULE_\w+)\]/g;

/**
 * Format a verified source as inline citation text for the pleading body.
 * Exported for unit tests.
 */
export function formatSourceCitation(source: Pick<VerifiedSource, 'title' | 'citation'>): string {
  const title = source.title?.trim();
  const citation = source.citation?.trim();
  if (title && citation) {
    // Avoid "Title Title" when citation already embeds the short case name.
    if (citation.toLowerCase().includes(title.toLowerCase().slice(0, Math.min(title.length, 24)))) {
      return citation;
    }
    return `${title}, ${citation}`;
  }
  return citation || title || '';
}

/**
 * Replace `[curated__…]` / `[SOURCE_1]` markers with human-readable citations.
 * Unknown IDs are unwrapped to plain text (never left as fillable blanks).
 * Exported for unit tests.
 */
export function resolveSourceReferences(
  text: string,
  sourceRegistry: VerifiedSourceRegistry,
): string {
  const byId = new Map(sourceRegistry.sources.map((s) => [s.id, s]));

  return text.replace(SOURCE_REF_RE, (full, id: string) => {
    const source = byId.get(id);
    if (!source) return id;
    const formatted = formatSourceCitation(source);
    return formatted || id;
  });
}

/** Strip duplicate markdown section headers when title already appears in body. Exported for tests. */
export function dedupeSectionHeader(body: string, title: string): string {
  const normalizedTitle = title.trim();
  if (!normalizedTitle) return body.trim();

  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let out = body.trim();

  const dupHeader = new RegExp(
    `^(#{1,3}\\s*${escape(normalizedTitle)}[^\\n]*\\n\\s*){2,}`,
    'im',
  );
  out = out.replace(dupHeader, (match) => {
    const first = match.split('\n').find((line) => /^#{1,3}\s/i.test(line)) ?? '';
    return first ? `${first}\n\n` : match;
  });

  return out.trim();
}

/**
 * Draft Assembly Service — deterministic, no LLM.
 *
 * Responsibilities:
 *   1. Order sections according to the execution plan wave order
 *   2. Resolve internal source IDs to readable citations
 *   3. Normalize excessive whitespace
 *   4. Generate citation appendix from the verified source registry
 *   5. Return the assembled draft with metadata
 */
@Injectable()
export class DraftAssemblyService {
  private readonly logger = new Logger(DraftAssemblyService.name);

  async assemble(input: AssembleInput): Promise<AssembledDraft> {
    const { jobId, sections, sourceRegistry, executionPlan } = input;

    // Sort sections by plan wave order
    const orderedSections = this.orderSections(sections, executionPlan);

    // Assemble full text with normalized formatting
    const sectionTexts: string[] = [];
    for (const section of orderedSections) {
      const header = this.formatSectionHeader(section.sectionType, section.title);
      const resolved = resolveSourceReferences(section.content, sourceRegistry);
      const body = dedupeSectionHeader(this.normalizeText(resolved), section.title);
      const headerAlreadyInBody =
        header &&
        new RegExp(`^#+\\s*${section.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'im').test(body);
      sectionTexts.push(
        header && !headerAlreadyInBody ? `${header}\n\n${body}` : body,
      );
    }

    const fullText = resolveSourceReferences(
      sectionTexts.join('\n\n---\n\n'),
      sourceRegistry,
    );
    const citationAppendix = this.buildCitationAppendix(sourceRegistry);

    const sectionSummary = orderedSections.map((s) => ({
      sectionKey: s.sectionKey,
      title: s.title,
      status: s.status,
      wordCount: s.content.split(/\s+/).filter(Boolean).length,
    }));

    const totalWordCount = sectionSummary.reduce((sum, s) => sum + s.wordCount, 0);

    this.logger.log(`Assembled draft for job ${jobId}: ${totalWordCount} words, ${citationAppendix.length} verified sources`);

    return {
      jobId,
      fullText,
      citationAppendix,
      sectionSummary,
      assembledAt: new Date().toISOString(),
      totalWordCount,
    };
  }

  private orderSections(
    sections: AssembleInput['sections'],
    plan: DraftExecutionPlan,
  ): AssembleInput['sections'] {
    // Build an ordered list from the plan waves
    const orderedKeys: string[] = [];
    for (const wave of plan.generationWaves) {
      orderedKeys.push(...wave);
    }

    const sectionMap = new Map(sections.map((s) => [s.sectionKey, s]));
    const ordered: AssembleInput['sections'] = [];

    // Add sections in plan order
    for (const key of orderedKeys) {
      const section = sectionMap.get(key);
      if (section) {
        ordered.push(section);
        sectionMap.delete(key);
      }
    }

    // Append any sections not in the plan (should not happen, but defensive)
    for (const remaining of sectionMap.values()) {
      ordered.push(remaining);
    }

    return ordered;
  }

  private formatSectionHeader(sectionType: string, title: string): string {
    const uppercaseHeadings = ['grounds', 'prayer', 'verification', 'facts', 'legal_grounds', 'arguments'];
    if (uppercaseHeadings.includes(sectionType)) {
      return title.toUpperCase();
    }
    return '';
  }

  private normalizeText(text: string): string {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\n{4,}/g, '\n\n\n')  // Cap at 3 consecutive newlines
      .replace(/[ \t]+$/gm, '')       // Trim trailing spaces on each line
      .trim();
  }

  private buildCitationAppendix(sourceRegistry: VerifiedSourceRegistry): CitationEntry[] {
    return sourceRegistry.sources
      .filter((s) => s.verificationStatus === 'verified')
      .map((s) => ({
        id: s.id,
        title: s.title,
        citation: s.citation,
        section: s.section,
        court: s.court,
        // Normalize internal 'case' to the API/frontend vocabulary 'case_law'
        type: s.type === 'case' ? 'case_law' : s.type,
        bindingLevel: s.bindingLevel,
      }))
      .sort((a, b) => {
        // Statutes first, then cases, then other
        const order = { statute: 0, case_law: 1, rule: 2, template: 3, matter_document: 4 };
        return (order[a.type as keyof typeof order] ?? 5) - (order[b.type as keyof typeof order] ?? 5);
      });
  }
}
