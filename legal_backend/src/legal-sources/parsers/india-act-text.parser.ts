import {
  isPrimarilyTableOrScheduleText,
  stripEmbeddedSchedulesAndTables,
} from '@/legal-search/section-text-sanitize';

export interface ParsedActSection {
  section: string;
  title: string;
  fullText: string;
  isRepealed?: boolean;
  repealNotes?: string;
}

/**
 * Detect whether a section body indicates the provision has been repealed,
 * omitted, or otherwise removed from the Act.
 *
 * Patterns are anchored to the start of the text or enclosed in brackets to
 * avoid false positives from contextual uses such as "power to repeal rules
 * made under this Act".
 */
export function detectRepealStatus(sectionText: string): {
  isRepealed: boolean;
  repealNotes?: string;
} {
  const trimmed = sectionText.trim();

  // Patterns that positively indicate a repealed / omitted provision.
  const REPEAL_PATTERNS: RegExp[] = [
    // Bracketed markers: [Omitted], [Omitted by Act 45 of 2023], [Repealed], [Rep. by Act ...]
    /^\s*\[(?:Omitted(?:\s+by\s+[^\]]+)?|Repealed(?:\s+by\s+[^\]]+)?|Rep\.(?:\s+by\s+[^\]]+)?)\]/i,
    // Start-of-text markers
    /^(?:Rep(?:ealed)?\.?\s+by\s+Act\b)/i,
    /^(?:Repealed\s+by\b)/i,
    /^(?:Omitted\s+by\s+(?:Act|the)\b)/i,
    /^(?:Section\s+omitted\b)/i,
    /^(?:This\s+section\s+(?:has\s+been|was)\s+(?:omitted|repealed)\b)/i,
    // Historical bare acts: repeal marker immediately after provision label only.
    /^(?:Article|Section|Sec\.?)\s+\d+[A-Za-z]?\s+rep\.\s+by\s+Act\b/im,
    // Bracketed repeal markers only in the opening window (not footnote cross-refs).
    /^[\s\S]{0,120}\[(?:Omitted(?:\s+by\s+[^\]]+)?|Repealed(?:\s+by\s+[^\]]+)?|Rep\.(?:\s+by\s+[^\]]+)?)\]/i,
  ];

  for (const pattern of REPEAL_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match) {
      const bracketIdx = trimmed.search(
        /\[(?:Omitted(?:\s+by\s+[^\]]+)?|Repealed(?:\s+by\s+[^\]]+)?|Rep\.(?:\s+by\s+[^\]]+)?)\]/i,
      );
      if (bracketIdx >= 0 && bracketIdx <= 120) {
        const prefix = trimmed.slice(Math.max(0, bracketIdx - 48), bracketIdx).toLowerCase();
        if (/\b(?:see|cf\.|refer(?:ence)?|note|vide)\s*[:.]?\s*$/.test(prefix)) {
          continue;
        }
      }
      // Capture the matched fragment or the first 200 chars as repeal note.
      const repealNotes = match[0].length > 0 ? match[0].trim() : trimmed.slice(0, 200).trim();
      return { isRepealed: true, repealNotes };
    }
  }

  return { isRepealed: false };
}

/** High-use Income-tax Act sections for priority-only ingest (80/20 coverage). */
export const IN_INCOME_TAX_PRIORITY_SECTIONS = [
  '2', '4', '5', '9', '10', '11', '12', '13', '14A', '17', '24', '27', '28',
  '36', '37', '40', '40A', '43B', '44AD', '45', '54', '54B', '54EC', '54F',
  '56', '57', '80C', '80D', '80G', '80TTA', '87A', '89', '90', '91', '92',
  '111', '112', '115B', '139', '140', '140A', '143', '147', '148', '153',
  '154', '156', '158', '191', '192', '194A', '194C', '195', '197', '201',
  '234A', '234B', '234C', '244A', '245', '246', '250', '253', '260', '263',
  '271', '276',
] as const;

const SECTION_HEADING =
  /^(?:SECTION|Section|Sec\.?|S\.?)\s*(\d+[A-Za-z]?)\s*(?:\.|[-–—:])?\s*(.*)$/;

const CHAPTER_HEADING = /^(?:CHAPTER|CHAP\.?)\s+([IVXLC\d]+)\s*(.*)$/i;

const NUMBERED_SECTION_SPLIT = /(?:^|\n)(\d+[A-Z]{0,3})\.\s+/g;

const ARTICLE_HEADING =
  /^(?:ARTICLE|Article|Art\.?)\s*(\d+[A-Za-z]?)\s*(?:\.|[-–—:])?\s*(.*)$/;

const SCHEDULE_HEADING = /^(?:SCHEDULE|Schedule)\s+([IVXLC\d]+[A-Za-z]?)\s*(.*)$/i;

const APPENDIX_HEADING = /^(?:APPENDIX|Appendix)\s+([IVXLC\d]+)\s*(.*)$/i;

const CONSTITUTION_ARTICLE_SPLIT = /(?:^|\n)(?:ARTICLE\s+)?(\d+[A-Z]{0,3})\.\s+/g;

const FOOTNOTE_LINE =
  /^(?:Subs\.|Ins\.|Omitted|Renumbered|Section \d+|vide notification|Gazette of India|\d{1,2}(?:st|nd|rd|th)\s)/i;

function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\f/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractTitleFromBody(body: string): string {
  const firstLine = body.split('\n').find((line) => line.trim().length > 0)?.trim() ?? '';
  if (firstLine.length <= 120) {
    return firstLine;
  }
  return firstLine.slice(0, 120).trim() + '…';
}

function extractTitleFromNumberedSection(section: string, body: string): string {
  const withoutPrefix = body.replace(new RegExp(`^${section}\\.\\s*`), '').trim();
  const prose = stripEmbeddedSchedulesAndTables(withoutPrefix);
  const firstLine = prose.split('\n').find((line) => line.trim().length > 0)?.trim() ?? '';
  const emDashSplit = firstLine.split(/\.—|—/);
  const title = emDashSplit[0]?.replace(/\.$/, '').trim() ?? '';
  if (title.length <= 120) {
    return title || extractTitleFromBody(prose);
  }
  return title.slice(0, 120).trim() + '…';
}

function isFootnoteBlock(body: string): boolean {
  const firstLine = body.split('\n').find((line) => line.trim())?.trim() ?? '';
  return FOOTNOTE_LINE.test(firstLine);
}

function comparableProvisionText(text: string): string {
  return text
    .replace(/^(?:(?:SECTION|Section|Sec\.?|S\.?)\s*)?\d+[A-Za-z]{0,3}\s*[.:\-–—]?\s*/i, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .toLowerCase();
}

/**
 * True when a parsed provision contains only its section heading/TOC label.
 * Short operative provisions are retained when they contain legal operators
 * such as "shall", "means", "may", or an enactment/repeal marker.
 */
export function isHeadingOnlySection(
  section: Pick<ParsedActSection, 'section' | 'title' | 'fullText' | 'isRepealed'>,
): boolean {
  if (section.isRepealed) return false;

  const withoutId = section.fullText
    .trim()
    .replace(
      new RegExp(
        `^(?:(?:SECTION|Section|Sec\\.?|S\\.?)\\s*)?${section.section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[.:\\-–—]?\\s*`,
        'i',
      ),
      '',
    )
    .trim();
  if (!withoutId) return true;

  const bodyComparable = comparableProvisionText(withoutId);
  const titleComparable = comparableProvisionText(section.title);
  if (!bodyComparable) return true;
  const substantiveLines = withoutId
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  if (
    substantiveLines.length > 1 &&
    titleComparable &&
    bodyComparable.startsWith(titleComparable) &&
    bodyComparable !== titleComparable
  ) {
    return false;
  }
  if (titleComparable && bodyComparable === titleComparable) return true;

  const remainder =
    titleComparable && bodyComparable.startsWith(titleComparable)
      ? bodyComparable.slice(titleComparable.length).trim()
      : bodyComparable;
  if (!remainder) return true;

  const hasOperativeLanguage =
    /\b(?:shall|may|must|means|includes|deemed|prohibited|punishable|liable|entitled|provided|notwithstanding|subject to|comes? into force|extends? to|repeal(?:ed)?|omitted)\b/i.test(
      remainder,
    );
  if (hasOperativeLanguage) return false;

  const words = remainder.split(/\s+/).filter(Boolean);
  const hasClausePunctuation = /[;:]|\.—|—|\([a-z0-9]+\)/i.test(withoutId);
  return words.length <= 14 && !hasClausePunctuation && withoutId.split('\n').length <= 2;
}

/** Whether a section is safe to use as substantive statute text. */
export function isUsableActSection(section: ParsedActSection): boolean {
  const body = stripEmbeddedSchedulesAndTables(section.fullText);
  return Boolean(body) && !isPrimarilyTableOrScheduleText(body) && !isHeadingOnlySection(section);
}

export interface ActSectionQuality {
  total: number;
  usable: number;
  headingOnly: number;
  stubRatio: number;
  acceptable: boolean;
}

/** Conservative whole-act gate: only reject a parse when stubs clearly dominate. */
export function assessActSectionQuality(
  sections: Array<Pick<ParsedActSection, 'section' | 'title' | 'fullText' | 'isRepealed'>>,
  options: { additionalHeadingOnly?: number } = {},
): ActSectionQuality {
  const headingOnly =
    sections.filter(isHeadingOnlySection).length + (options.additionalHeadingOnly ?? 0);
  const usable = sections.filter((section) => isUsableActSection(section as ParsedActSection)).length;
  const total = sections.length + (options.additionalHeadingOnly ?? 0);
  const stubRatio = total === 0 ? 1 : headingOnly / total;
  const acceptable =
    total > 0 &&
    (total < 5 || (stubRatio < 0.5 && usable >= Math.max(3, Math.ceil(total * 0.4))));
  return { total, usable, headingOnly, stubRatio, acceptable };
}

/** Parse India Code style numbered sections (e.g. "7. Jurisdiction.—(1) ..."). */
function parseNumberedIndianSections(text: string): ParsedActSection[] {
  const matches = [...text.matchAll(NUMBERED_SECTION_SPLIT)];
  if (matches.length === 0) {
    return [];
  }

  const bySection = new Map<string, ParsedActSection>();

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const section = match[1];
    const bodyStart = (match.index ?? 0) + match[0].length;
    const end = index + 1 < matches.length ? (matches[index + 1].index ?? text.length) : text.length;
    const rawBody = text.slice(bodyStart, end).trim();
    const cleanedBody = stripEmbeddedSchedulesAndTables(rawBody);
    const fullText = `${section}. ${cleanedBody}`.trim();

    if (!cleanedBody || isFootnoteBlock(fullText)) {
      continue;
    }

    const { isRepealed: repStatus, repealNotes: repNotes } = detectRepealStatus(cleanedBody);
    const candidate: ParsedActSection = {
      section,
      title: extractTitleFromNumberedSection(section, fullText),
      fullText,
      ...(repStatus && { isRepealed: repStatus, repealNotes: repNotes }),
    };

    const existing = bySection.get(section);
    if (!existing || sectionQualityScore(candidate) > sectionQualityScore(existing)) {
      bySection.set(section, candidate);
    }
  }

  return [...bySection.values()].sort(
    (a, b) => parseInt(a.section, 10) - parseInt(b.section, 10) || a.section.localeCompare(b.section),
  );
}

function parseExplicitSectionHeadings(text: string): ParsedActSection[] {
  const lines = text.split('\n');
  const sections: ParsedActSection[] = [];
  let currentSection: string | null = null;
  let currentTitle = '';
  let currentBody: string[] = [];

  const flush = () => {
    if (!currentSection) return;
    const rawBody = currentBody.join('\n').trim();
    const body = stripEmbeddedSchedulesAndTables(rawBody);
    if (!body || isPrimarilyTableOrScheduleText(body)) return;
    const { isRepealed, repealNotes } = detectRepealStatus(body);
    sections.push({
      section: currentSection,
      title: currentTitle || extractTitleFromBody(body),
      fullText: body,
      ...(isRepealed && { isRepealed, repealNotes }),
    });
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (currentSection) currentBody.push('');
      continue;
    }

    if (trimmed.match(CHAPTER_HEADING)) {
      flush();
      currentSection = null;
      currentBody = [];
      continue;
    }

    const sectionMatch = trimmed.match(SECTION_HEADING);
    if (sectionMatch) {
      flush();
      currentSection = sectionMatch[1];
      currentTitle = sectionMatch[2]?.trim() || `Section ${sectionMatch[1]}`;
      currentBody = [trimmed];
      continue;
    }

    if (currentSection) {
      currentBody.push(trimmed);
    }
  }

  flush();
  return sections;
}

export function sectionQualityScore(section: ParsedActSection): number {
  const body = stripEmbeddedSchedulesAndTables(section.fullText);
  if (!body || isPrimarilyTableOrScheduleText(body)) {
    return 0;
  }
  if (isHeadingOnlySection(section)) {
    return Math.min(body.length, 50);
  }
  let score = body.length;
  if (section.title && !isPrimarilyTableOrScheduleText(section.title)) {
    score += 500;
  }
  if (/\b(?:shall|may|means|includes|provided that|notwithstanding)\b/i.test(body)) {
    score += 250;
  }
  return score;
}

function mergeSectionLists(...lists: ParsedActSection[][]): ParsedActSection[] {
  const bySection = new Map<string, ParsedActSection>();

  for (const list of lists) {
    for (const section of list) {
      const existing = bySection.get(section.section);
      if (!existing || sectionQualityScore(section) > sectionQualityScore(existing)) {
        bySection.set(section.section, section);
      }
    }
  }

  return [...bySection.values()];
}

function applyPriorityFilter(
  sections: ParsedActSection[],
  prioritySections?: readonly string[],
): ParsedActSection[] {
  if (!prioritySections?.length) {
    return sections;
  }

  const prioritySet = new Set(
    prioritySections.map((s) => s.toUpperCase().replace(/\s+/g, '')),
  );
  return sections.filter((s) =>
    prioritySet.has(s.section.toUpperCase().replace(/\s+/g, '')),
  );
}

/**
 * Split bare-act plain text into section records.
 * Falls back to fixed-size chunks when no section headings are detected.
 */
export function parseActTextIntoSections(
  rawText: string,
  options?: { prioritySections?: readonly string[]; includeHeadingOnly?: boolean },
): ParsedActSection[] {
  const text = normalizeWhitespace(rawText);
  if (!text) {
    return [];
  }

  const explicit = parseExplicitSectionHeadings(text);
  const numbered = parseNumberedIndianSections(text);
  let sections = mergeSectionLists(explicit, numbered);

  if (sections.length === 0) {
    sections = chunkTextFallback(text);
  }

  const candidates = options?.includeHeadingOnly ? sections : sections.filter(isUsableActSection);
  return applyPriorityFilter(candidates, options?.prioritySections);
}

function parseConstitutionArticleHeadings(text: string): ParsedActSection[] {
  const lines = text.split('\n');
  const sections: ParsedActSection[] = [];
  let currentSection: string | null = null;
  let currentTitle = '';
  let currentBody: string[] = [];

  const flush = () => {
    if (!currentSection) return;
    const body = currentBody.join('\n').trim();
    if (!body) return;
    const { isRepealed, repealNotes } = detectRepealStatus(body);
    sections.push({
      section: currentSection,
      title: currentTitle || `Article ${currentSection}`,
      fullText: body,
      ...(isRepealed && { isRepealed, repealNotes }),
    });
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (currentSection) currentBody.push('');
      continue;
    }

    const scheduleMatch = trimmed.match(SCHEDULE_HEADING);
    if (scheduleMatch) {
      flush();
      currentSection = `schedule-${scheduleMatch[1]}`;
      currentTitle = scheduleMatch[2]?.trim() || `Schedule ${scheduleMatch[1]}`;
      currentBody = [trimmed];
      continue;
    }

    const appendixMatch = trimmed.match(APPENDIX_HEADING);
    if (appendixMatch) {
      flush();
      currentSection = `appendix-${appendixMatch[1]}`;
      currentTitle = appendixMatch[2]?.trim() || `Appendix ${appendixMatch[1]}`;
      currentBody = [trimmed];
      continue;
    }

    const articleMatch = trimmed.match(ARTICLE_HEADING);
    if (articleMatch) {
      flush();
      currentSection = articleMatch[1];
      currentTitle = articleMatch[2]?.trim() || `Article ${articleMatch[1]}`;
      currentBody = [trimmed];
      continue;
    }

    if (currentSection) {
      currentBody.push(trimmed);
    }
  }

  flush();
  return sections;
}

function parseConstitutionNumberedArticles(text: string): ParsedActSection[] {
  const matches = [...text.matchAll(CONSTITUTION_ARTICLE_SPLIT)];
  if (matches.length < 3) {
    return [];
  }

  const bySection = new Map<string, ParsedActSection>();

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const section = match[1];
    const bodyStart = (match.index ?? 0) + match[0].length;
    const end = index + 1 < matches.length ? (matches[index + 1].index ?? text.length) : text.length;
    const rawBody = text.slice(bodyStart, end).trim();
    const fullText = `Article ${section}. ${rawBody}`.trim();

    if (!rawBody || isFootnoteBlock(fullText)) {
      continue;
    }

    const { isRepealed: repStatus2, repealNotes: repNotes2 } = detectRepealStatus(rawBody);
    const candidate: ParsedActSection = {
      section,
      title: extractTitleFromNumberedSection(section, fullText),
      fullText,
      ...(repStatus2 && { isRepealed: repStatus2, repealNotes: repNotes2 }),
    };

    const existing = bySection.get(section);
    if (!existing || candidate.fullText.length > existing.fullText.length) {
      bySection.set(section, candidate);
    }
  }

  return [...bySection.values()];
}

/** Parse Constitution of India text into Article / Schedule / Appendix records. */
export function parseConstitutionTextIntoSections(rawText: string): ParsedActSection[] {
  const text = normalizeWhitespace(rawText);
  if (!text) {
    return [];
  }

  const explicit = parseConstitutionArticleHeadings(text);
  const numbered = parseConstitutionNumberedArticles(text);
  let sections = mergeSectionLists(explicit, numbered);

  if (sections.length === 0) {
    sections = chunkTextFallback(text);
  }

  return sections;
}

export function chunkTextFallback(text: string, chunkSize = 1200): ParsedActSection[] {
  const normalized = text.trim();
  if (!normalized) return [];

  const chunks: ParsedActSection[] = [];
  for (let index = 0; index < normalized.length; index += chunkSize) {
    const slice = normalized.slice(index, index + chunkSize);
    const chunkIndex = Math.floor(index / chunkSize);
    chunks.push({
      section: `chunk-${chunkIndex + 1}`,
      title: `Excerpt ${chunkIndex + 1}`,
      fullText: slice,
    });
  }
  return chunks;
}

/** Strip HTML tags and decode common entities from India Code pages. */
export function htmlToPlainText(html: string): string {
  return normalizeWhitespace(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/h[1-6]>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'"),
  );
}
