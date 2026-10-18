import type { StatuteSectionFetchResult } from '../connectors/us-code.connector';

const SOURCE_NAME = 'Kenya Law (source.pdf)';
const MIN_FULL_DOC_CHARS = 200;

/** Explicit "Section 12 — Short title" / "Sec. 3." / "ARTICLE 10" headings. */
const EXPLICIT_HEADING =
  /^(?:Section|Sec\.?|ARTICLE|Article)\s+(\d+[A-Za-z]?)\b(?:\s*[.—:\-–—]\s*(.*))?$/i;

/**
 * Numbered section starts common in Kenyan amendment / appropriation PDFs:
 * "1. This Act may be cited as…" or "12A. Amendment of section…"
 * Avoid matching bare years / money amounts by requiring a following letter.
 */
const NUMBERED_HEADING = /^(\d+[A-Za-z]?)\.\s+([A-Za-z(].{0,200})$/;

export interface KenyaActPdfParseResult {
  sections: StatuteSectionFetchResult[];
  /** False when we fell back to a single `full` blob or found no sections. */
  complete: boolean;
}

/**
 * Split Kenya Law source.pdf plain text into statute sections.
 * Prefer explicit Section/Article headings; fall back to numbered "N. …" lines;
 * if still < 2 sections and the body is long, store one synthetic `full` section.
 */
export function parseKenyaActPdfText(
  rawText: string,
  sourceUrl: string,
): KenyaActPdfParseResult {
  const text = normalizePdfText(rawText);
  if (text.length < 8) {
    return { sections: [], complete: false };
  }

  const explicit = splitByLineHeadings(text, sourceUrl, EXPLICIT_HEADING);
  if (explicit.length >= 2) {
    return { sections: explicit, complete: true };
  }

  const numbered = splitByLineHeadings(text, sourceUrl, NUMBERED_HEADING);
  if (numbered.length >= 2) {
    return { sections: numbered, complete: true };
  }

  if (explicit.length === 1) {
    return { sections: explicit, complete: false };
  }
  if (numbered.length === 1) {
    return { sections: numbered, complete: false };
  }

  if (text.length >= MIN_FULL_DOC_CHARS) {
    return {
      sections: [
        {
          section: 'full',
          title: 'Full text',
          summary: text.slice(0, 400),
          fullText: text,
          sourceUrl,
          sourceName: SOURCE_NAME,
        },
      ],
      complete: false,
    };
  }

  return { sections: [], complete: false };
}

function normalizePdfText(raw: string): string {
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function splitByLineHeadings(
  text: string,
  sourceUrl: string,
  headingRe: RegExp,
): StatuteSectionFetchResult[] {
  const lines = text.split('\n');
  type Block = { section: string; title: string; body: string[] };
  const blocks: Block[] = [];
  let current: Block | null = null;

  const flush = () => {
    if (!current) return;
    const fullText = current.body.join('\n').trim().replace(/\n{3,}/g, '\n\n');
    if (fullText.length < 8) {
      current = null;
      return;
    }
    blocks.push(current);
    current = null;
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (current) current.body.push('');
      continue;
    }

    const match = trimmed.match(headingRe);
    if (match) {
      flush();
      const section = match[1];
      const rest = (match[2] ?? '').trim();
      const title = rest
        ? `Section ${section} — ${rest.slice(0, 120)}`
        : `Section ${section}`;
      current = {
        section,
        title,
        body: [trimmed],
      };
      continue;
    }

    if (current) {
      current.body.push(trimmed);
    }
  }
  flush();

  const bySection = new Map<string, StatuteSectionFetchResult>();
  for (const block of blocks) {
    const fullText = block.body.join('\n').trim().replace(/\n{3,}/g, '\n\n');
    const candidate: StatuteSectionFetchResult = {
      section: block.section,
      title: block.title,
      summary: fullText.slice(0, 400),
      fullText,
      sourceUrl,
      sourceName: SOURCE_NAME,
    };
    const existing = bySection.get(block.section);
    if (!existing || candidate.fullText.length > existing.fullText.length) {
      bySection.set(block.section, candidate);
    }
  }

  return [...bySection.values()].sort((a, b) => {
    const an = parseInt(a.section, 10);
    const bn = parseInt(b.section, 10);
    if (Number.isFinite(an) && Number.isFinite(bn) && an !== bn) return an - bn;
    return a.section.localeCompare(b.section, undefined, { numeric: true });
  });
}
