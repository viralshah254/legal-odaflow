/**
 * Strips repetitive citation-disclaimer noise from legal research markdown.
 * Applied after LLM generation and citation audit so user-facing memos stay clean.
 */

const PER_ITEM_CITATION_DISCLAIMER_PATTERNS: RegExp[] = [
  /\s*\*Citation needs verification\.\*/gi,
  /\s*\*?Citation needs verification\*?\.?/gi,
  /\s*\[Needs verification\]/gi,
  /\s*—?\s*Needs verification — could not confirm from retrieved sources\.?/gi,
  /\s*\(confirm via SCC Online \/ Manupatra \/ e-SCR\)/gi,
];

/** Full paragraphs the model sometimes adds despite prompt discipline. */
const BOILERPLATE_PARAGRAPH_PATTERNS: RegExp[] = [
  /I have deliberately not asserted the precise volume\/page numbers[\s\S]*?before filing\.?\s*/gi,
  /Each is a genuine, well-known decision; please confirm the exact citation before filing\.?\s*/gi,
];

/** Verbose section headers — replaced with a shorter label. */
const VERBOSE_SECTION_HEADER =
  /Model knowledge — well-known landmark cases, citations NOT verified from retrieved corpus[^:\n]*:/gi;

export function sanitizeResearchOutputMarkdown(markdown: string): string {
  let out = markdown;

  for (const pattern of PER_ITEM_CITATION_DISCLAIMER_PATTERNS) {
    out = out.replace(pattern, '');
  }

  for (const pattern of BOILERPLATE_PARAGRAPH_PATTERNS) {
    out = out.replace(pattern, '');
  }

  out = out.replace(VERBOSE_SECTION_HEADER, 'Supplemental landmark cases:');

  // Collapse trailing whitespace on lines left empty-ish after stripping disclaimers.
  out = out
    .split('\n')
    .map((line) => line.replace(/\s+$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return out;
}
