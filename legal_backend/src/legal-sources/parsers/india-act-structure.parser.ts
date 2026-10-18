import {
  detectRepealStatus,
  isUsableActSection,
  parseActTextIntoSections,
  parseConstitutionTextIntoSections,
  sectionQualityScore,
  type ParsedActSection,
} from './india-act-text.parser';

export type ProvisionType = 'section' | 'article' | 'order' | 'schedule' | 'appendix';

export interface ParsedActProvision {
  provisionType: ProvisionType;
  provisionId: string;
  title: string;
  fullText: string;
  isRepealed?: boolean;
  repealNotes?: string;
}

export interface ActStructureUnit {
  count: number;
  ids: string[];
  lastId?: string;
}

export interface ActStructureProfile {
  sections?: ActStructureUnit;
  articles?: ActStructureUnit;
  orders?: ActStructureUnit;
  schedules?: ActStructureUnit;
  appendices?: ActStructureUnit;
  structureProfile: string;
}

export interface ParseActProvisionsOptions {
  documentType?: 'constitution' | 'act';
  prioritySections?: readonly string[];
  strictArrangement?: boolean;
}

export interface ParseActProvisionsResult {
  provisions: ParsedActProvision[];
  structure: ActStructureProfile;
  arrangement: ReturnType<typeof extractArrangementIds>;
  quality: { rejectedHeadingOnlySections: number };
}

const YEAR_SECTION_ID = /^(18|19|20)\d{2}[A-Z]{0,3}$/;

const ARRANGEMENT_END =
  /^An Act |^BE it enacted|^THE FIRST SCHEDULE|^BILL NO\./i;

const STRONG_ARRANGEMENT_BODY_BOUNDARY =
  /^(?:An Act\b|BE it enacted\b|BILL NO\.|THE FIRST SCHEDULE\b)/i;

function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\f/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function isYearFalsePositive(id: string, allowlist: Set<string>): boolean {
  const upper = id.toUpperCase();
  if (allowlist.has(upper)) return false;
  return YEAR_SECTION_ID.test(upper);
}

function uniqueSortedIds(ids: string[]): string[] {
  return [...new Set(ids.map((id) => id.toUpperCase()))].sort((a, b) => {
    const na = parseInt(a, 10);
    const nb = parseInt(b, 10);
    if (!Number.isNaN(na) && !Number.isNaN(nb) && na !== nb) return na - nb;
    return a.localeCompare(b, undefined, { numeric: true });
  });
}

function buildUnit(ids: string[]): ActStructureUnit | undefined {
  const normalized = uniqueSortedIds(ids);
  if (normalized.length === 0) return undefined;
  return {
    count: normalized.length,
    ids: normalized,
    lastId: normalized[normalized.length - 1],
  };
}

/** Extract IDs listed under Arrangement blocks in India Code PDFs. */
export function extractArrangementIds(text: string): {
  sections: string[];
  articles: string[];
  orders: string[];
  schedules: string[];
} {
  const sections: string[] = [];
  const articles: string[] = [];
  const orders: string[] = [];
  const schedules: string[] = [];

  let mode: 'sections' | 'articles' | 'orders' | 'schedules' | null = null;

  for (const line of text.split('\n')) {
    const t = line.trim();
    if (/ARRANGEMENT OF SECTIONS/i.test(t)) {
      mode = 'sections';
      continue;
    }
    if (/ARRANGEMENT OF ARTICLES/i.test(t)) {
      mode = 'articles';
      continue;
    }
    if (/ARRANGEMENT OF ORDERS/i.test(t)) {
      mode = 'orders';
      continue;
    }
    if (mode && ARRANGEMENT_END.test(t)) {
      mode = null;
      continue;
    }

    if (mode === 'sections') {
      const m = t.match(/^(\d+[A-Z]{0,3})\.\s+/);
      if (m) sections.push(m[1].toUpperCase());
    } else if (mode === 'articles') {
      const m = t.match(/^Article\s+(\d+[A-Z]{0,3})\.?\s+/i) || t.match(/^(\d+[A-Z]{0,3})\.\s+/);
      if (m) articles.push(m[1].toUpperCase());
    } else if (mode === 'orders') {
      const m =
        t.match(/^ORDER\s+([IVXLC]+|\d+[A-Z]?)\.?\s+/i) || t.match(/^(\d+[A-Z]{0,3})\.\s+/);
      if (m) orders.push(m[1].toUpperCase());
    }

    const scheduleInArr = t.match(/^SCHEDULE\s+([IVXLC\d]+[A-Z]?)\b/i);
    if (scheduleInArr) schedules.push(scheduleInArr[1].toUpperCase());
  }

  const sectionAllow = new Set(sections);
  return {
    sections: sections.filter((id) => !isYearFalsePositive(id, sectionAllow)),
    articles: uniqueSortedIds(articles),
    orders: uniqueSortedIds(orders),
    schedules: uniqueSortedIds(schedules),
  };
}

function extractOrderIdsFromBody(text: string): string[] {
  const ids: string[] = [];
  const re = /\bORDER\s+([IVXLC]+|\d+[A-Z]?)\b/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const id = match[1].toUpperCase();
    if (id !== '1' || ids.length > 0) ids.push(id);
  }
  return uniqueSortedIds(ids);
}

function extractScheduleIdsFromBody(text: string): string[] {
  const ids: string[] = [];
  const re = /\bSCHEDULE\s+([IVXLC\d]+[A-Z]?)\b/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    ids.push(match[1].toUpperCase());
  }
  return uniqueSortedIds(ids);
}

function sectionToProvision(section: ParsedActSection): ParsedActProvision {
  const rawId = section.section;
  if (rawId.startsWith('schedule-')) {
    return {
      provisionType: 'schedule',
      provisionId: rawId.replace(/^schedule-/i, ''),
      title: section.title,
      fullText: section.fullText,
      isRepealed: section.isRepealed,
      repealNotes: section.repealNotes,
    };
  }
  if (rawId.startsWith('appendix-')) {
    return {
      provisionType: 'appendix',
      provisionId: rawId.replace(/^appendix-/i, ''),
      title: section.title,
      fullText: section.fullText,
      isRepealed: section.isRepealed,
      repealNotes: section.repealNotes,
    };
  }
  if (/^[IVXLC]+$/.test(rawId) && rawId.length <= 6) {
    return {
      provisionType: 'order',
      provisionId: rawId,
      title: section.title,
      fullText: section.fullText,
      isRepealed: section.isRepealed,
      repealNotes: section.repealNotes,
    };
  }
  return {
    provisionType: /^\d/.test(rawId) ? 'section' : 'article',
    provisionId: rawId,
    title: section.title,
    fullText: section.fullText,
    isRepealed: section.isRepealed,
    repealNotes: section.repealNotes,
  };
}

function parseOrderBlocks(text: string, allowedIds?: Set<string>): ParsedActProvision[] {
  const provisions: ParsedActProvision[] = [];
  const orderRe = /(?:^|\n)ORDER\s+([IVXLC]+|\d+[A-Z]?)\.?\s+([^\n]*)/gi;
  const matches = [...text.matchAll(orderRe)];
  if (matches.length === 0) return provisions;

  for (let i = 0; i < matches.length; i += 1) {
    const match = matches[i];
    const id = match[1].toUpperCase();
    if (allowedIds && !allowedIds.has(id)) continue;
    const start = match.index ?? 0;
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? text.length) : text.length;
    const body = text.slice(start, end).trim();
    const titleLine = match[2]?.trim() || `Order ${id}`;
    const { isRepealed, repealNotes } = detectRepealStatus(body);
    provisions.push({
      provisionType: 'order',
      provisionId: id,
      title: titleLine,
      fullText: body,
      ...(isRepealed && { isRepealed, repealNotes }),
    });
  }
  return provisions;
}

function parseScheduleBlocks(text: string, allowedIds?: Set<string>): ParsedActProvision[] {
  const provisions: ParsedActProvision[] = [];
  const scheduleRe = /(?:^|\n)SCHEDULE\s+([IVXLC\d]+[A-Z]?)\.?\s*([^\n]*)/gi;
  const matches = [...text.matchAll(scheduleRe)];
  if (matches.length === 0) return provisions;

  for (let i = 0; i < matches.length; i += 1) {
    const match = matches[i];
    const id = match[1].toUpperCase();
    if (allowedIds && !allowedIds.has(id)) continue;
    const start = match.index ?? 0;
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? text.length) : text.length;
    const body = text.slice(start, end).trim();
    const titleLine = match[2]?.trim() || `Schedule ${id}`;
    const { isRepealed, repealNotes } = detectRepealStatus(body);
    provisions.push({
      provisionType: 'schedule',
      provisionId: id,
      title: titleLine,
      fullText: body,
      ...(isRepealed && { isRepealed, repealNotes }),
    });
  }
  return provisions;
}

function extractBodiesForSectionIds(
  text: string,
  sectionIds: string[],
): ParsedActProvision[] {
  if (sectionIds.length === 0) return [];

  const arrangementBoundary = findArrangementBodyBoundary(text);
  const provisions: ParsedActProvision[] = [];
  const occurrences = sectionIds
    .map((id) => {
      const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`(?:^|\\n)${escaped}\\.\\s+`, 'gi');
      const matches = [...text.matchAll(re)];
      const preferred = matches.find((match) => (match.index ?? -1) >= arrangementBoundary);
      const match = preferred ?? matches[0];
      if (!match || match.index == null) return undefined;
      return {
        id,
        match,
        headingStart: match.index,
        bodyStart: match.index + match[0].length,
      };
    })
    .filter((value): value is NonNullable<typeof value> => Boolean(value))
    .sort((a, b) => a.headingStart - b.headingStart);

  for (let index = 0; index < occurrences.length; index += 1) {
    const { id, bodyStart: start } = occurrences[index];
    const end = occurrences[index + 1]?.headingStart ?? text.length;

    const rawBody = text.slice(start, end).trim();
    if (!rawBody || rawBody.length < 10) continue;

    const firstLine = rawBody.split('\n')[0]?.trim() ?? '';
    const title = firstLine.slice(0, 200);
    const fullText = `${id}. ${rawBody}`.trim();
    const { isRepealed, repealNotes } = detectRepealStatus(rawBody);

    const candidate: ParsedActProvision = {
      provisionType: 'section',
      provisionId: id,
      title,
      fullText,
      ...(isRepealed && { isRepealed, repealNotes }),
    };
    if (isUsableProvision(candidate)) {
      provisions.push(candidate);
    }
  }

  return provisions;
}

/**
 * Return an offset after the arrangement table. It is based on trimmed line
 * positions and only searches a bounded window after the final listed item.
 * ACT NO. is intentionally not a boundary because PDF footnotes often repeat it.
 */
export function findArrangementBodyBoundary(text: string): number {
  let offset = 0;
  let inArrangement = false;
  let arrangementSeen = false;
  let arrangementStartOffset = 0;
  let lastEntryEnd = 0;
  const seenArrangementSectionIds = new Set<string>();
  const lines = text.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    const lineEnd = offset + line.length + 1;
    if (/ARRANGEMENT OF (?:SECTIONS|ARTICLES|ORDERS)/i.test(trimmed)) {
      inArrangement = true;
      arrangementSeen = true;
      arrangementStartOffset = offset;
      lastEntryEnd = lineEnd;
    } else if (inArrangement) {
      if (offset - arrangementStartOffset > 100_000) {
        break;
      }
      if (/^ACT NO\./i.test(trimmed)) {
        const lookahead = text.slice(lineEnd, Math.min(text.length, lineEnd + 8_000));
        const bodyMarker = lookahead.search(
          /(?:^|\n)\s*(?:An\s+Act\b|BE\s+it\s+enacted\b|WHEREAS\b|1\.\s+(?:Short title|This Act))/im,
        );
        const beforeMarker = bodyMarker >= 0 ? lookahead.slice(0, bodyMarker) : lookahead;
        const hasMoreArrangementEntries =
          /(?:^|\n)\s*\d+[A-Z]{0,3}\.\s+\S/im.test(beforeMarker);
        if (bodyMarker >= 0 && !hasMoreArrangementEntries) {
          return offset;
        }
      }
      const sectionEntry = trimmed.match(/^(\d+[A-Z]{0,3})\.\s+/i);
      if (
        sectionEntry?.[1] === '1' &&
        seenArrangementSectionIds.has('1') &&
        seenArrangementSectionIds.size >= 2
      ) {
        return offset;
      }
      if (sectionEntry) {
        seenArrangementSectionIds.add(sectionEntry[1].toUpperCase());
        lastEntryEnd = lineEnd;
      } else if (
        /^(?:Article\s+\d+[A-Z]{0,3}\.?|ORDER\s+(?:[IVXLC]+|\d+[A-Z]?)\.?)/i.test(trimmed)
      ) {
        lastEntryEnd = lineEnd;
      }
      if (STRONG_ARRANGEMENT_BODY_BOUNDARY.test(trimmed)) {
        return offset;
      }
    }
    offset = lineEnd;
  }

  if (!arrangementSeen) return 0;
  const boundedEnd = Math.min(text.length, lastEntryEnd + 50_000);
  const postArrangement = text.slice(lastEntryEnd, boundedEnd);
  let relativeOffset = 0;
  for (const line of postArrangement.split('\n')) {
    if (STRONG_ARRANGEMENT_BODY_BOUNDARY.test(line.trim())) {
      return lastEntryEnd + relativeOffset;
    }
    relativeOffset += line.length + 1;
  }
  return Math.min(lastEntryEnd, text.length);
}

function provisionAsSection(provision: ParsedActProvision): ParsedActSection {
  return {
    section: provision.provisionId,
    title: provision.title,
    fullText: provision.fullText,
    isRepealed: provision.isRepealed,
    repealNotes: provision.repealNotes,
  };
}

export function isUsableProvision(provision: ParsedActProvision): boolean {
  return isUsableActSection(provisionAsSection(provision));
}

export function provisionQualityScore(provision: ParsedActProvision): number {
  return sectionQualityScore(provisionAsSection(provision));
}

function mergeProvisionCandidates(
  ...candidateLists: ParsedActProvision[][]
): ParsedActProvision[] {
  const byKey = new Map<string, ParsedActProvision>();
  for (const candidates of candidateLists) {
    for (const candidate of candidates) {
      const key = `${candidate.provisionType}:${candidate.provisionId.toUpperCase()}`;
      const existing = byKey.get(key);
      if (!existing || provisionQualityScore(candidate) > provisionQualityScore(existing)) {
        byKey.set(key, candidate);
      }
    }
  }
  return [...byKey.values()];
}

function filterSectionsByArrangement(
  sections: ParsedActSection[],
  arrangementIds: string[],
): ParsedActSection[] {
  if (arrangementIds.length === 0) return sections;
  const allow = new Set(arrangementIds.map((id) => id.toUpperCase()));
  return sections.filter((s) => allow.has(s.section.toUpperCase()));
}

/** Map provision to storage section key used by StatuteIngestService. */
export function provisionToStorageSection(provision: ParsedActProvision): string {
  switch (provision.provisionType) {
    case 'order':
      return `order-${provision.provisionId}`;
    case 'schedule':
      return `schedule-${provision.provisionId}`;
    case 'article':
      return provision.provisionId;
    case 'appendix':
      return `appendix-${provision.provisionId}`;
    default:
      return provision.provisionId;
  }
}

export function detectActStructureProfile(structure: ActStructureProfile): string {
  const parts: string[] = [];
  if (structure.sections?.count) parts.push('sections');
  if (structure.articles?.count) parts.push('articles');
  if (structure.orders?.count) parts.push('orders');
  if (structure.schedules?.count) parts.push('schedules');
  if (structure.appendices?.count) parts.push('appendices');
  return parts.join('+') || 'sections';
}

export function buildActStructureProfile(
  provisions: ParsedActProvision[],
): ActStructureProfile {
  const byType = (type: ProvisionType) =>
    buildUnit(provisions.filter((p) => p.provisionType === type).map((p) => p.provisionId));

  const structure: ActStructureProfile = {
    sections: byType('section'),
    articles: byType('article'),
    orders: byType('order'),
    schedules: byType('schedule'),
    appendices: byType('appendix'),
    structureProfile: '',
  };
  structure.structureProfile = detectActStructureProfile(structure);
  return structure;
}

export function validateProvisionsAgainstArrangement(
  provisions: ParsedActProvision[],
  arrangement: ReturnType<typeof extractArrangementIds>,
  opts: { strict?: boolean } = {},
): string[] {
  const errors: string[] = [];
  const strict = opts.strict ?? true;
  if (!strict) return errors;

  const check = (type: ProvisionType, expected: string[]) => {
    if (expected.length === 0) return;
    const parsed = uniqueSortedIds(
      provisions.filter((p) => p.provisionType === type).map((p) => p.provisionId),
    );
    const expectedSet = new Set(expected);
    const parsedSet = new Set(parsed);
    for (const id of expected) {
      if (!parsedSet.has(id)) errors.push(`Missing ${type} ${id} in parsed body`);
    }
    for (const id of parsed) {
      if (!expectedSet.has(id)) errors.push(`Unexpected ${type} ${id} not in arrangement`);
    }
  };

  check('section', arrangement.sections);
  check('article', arrangement.articles);
  check('order', arrangement.orders);
  check('schedule', arrangement.schedules);
  return errors;
}

/**
 * Parse all provision types from India Code bare-act plain text.
 * Uses arrangement tables as canonical ID lists when present.
 */
export function parseActTextIntoProvisions(
  rawText: string,
  options: ParseActProvisionsOptions = {},
): ParseActProvisionsResult {
  const text = normalizeWhitespace(rawText);
  if (!text) {
    return {
      provisions: [],
      structure: { structureProfile: 'sections' },
      arrangement: { sections: [], articles: [], orders: [], schedules: [] },
      quality: { rejectedHeadingOnlySections: 0 },
    };
  }

  const arrangement = extractArrangementIds(text);
  const provisions: ParsedActProvision[] = [];
  let rejectedHeadingOnlySections = 0;

  if (options.documentType === 'constitution') {
    const articles = parseConstitutionTextIntoSections(text).map((s) => {
      if (s.section.startsWith('schedule-')) {
        return {
          provisionType: 'schedule' as const,
          provisionId: s.section.replace(/^schedule-/i, ''),
          title: s.title,
          fullText: s.fullText,
          isRepealed: s.isRepealed,
          repealNotes: s.repealNotes,
        };
      }
      if (s.section.startsWith('appendix-')) {
        return {
          provisionType: 'appendix' as const,
          provisionId: s.section.replace(/^appendix-/i, ''),
          title: s.title,
          fullText: s.fullText,
          isRepealed: s.isRepealed,
          repealNotes: s.repealNotes,
        };
      }
      return {
        provisionType: 'article' as const,
        provisionId: s.section,
        title: s.title,
        fullText: s.fullText,
        isRepealed: s.isRepealed,
        repealNotes: s.repealNotes,
      };
    });
    provisions.push(...articles);
  } else {
    if (arrangement.sections.length > 0) {
      const prioritySet = options.prioritySections?.length
        ? new Set(options.prioritySections.map((id) => id.toUpperCase().replace(/\s+/g, '')))
        : undefined;
      const arrangementIds = prioritySet
        ? arrangement.sections.filter((id) => prioritySet.has(id.toUpperCase().replace(/\s+/g, '')))
        : arrangement.sections;
      const fromArrangement = extractBodiesForSectionIds(text, arrangementIds);
      let parsedSections = parseActTextIntoSections(text, {
        prioritySections: options.prioritySections,
        includeHeadingOnly: true,
      });
      parsedSections = filterSectionsByArrangement(parsedSections, arrangementIds);
      const mergedSections = mergeProvisionCandidates(
        fromArrangement,
        parsedSections.map(sectionToProvision),
      );
      rejectedHeadingOnlySections += mergedSections.filter(
        (candidate) => !isUsableProvision(candidate),
      ).length;
      provisions.push(...mergedSections.filter(isUsableProvision));
    } else {
      let sections = parseActTextIntoSections(text, {
        prioritySections: options.prioritySections,
        includeHeadingOnly: true,
      });
      rejectedHeadingOnlySections += sections.filter(
        (section) => !isUsableActSection(section),
      ).length;
      sections = sections.filter(isUsableActSection);
      for (const section of sections) {
        provisions.push(sectionToProvision(section));
      }
    }

    const orderIds =
      arrangement.orders.length > 0 ? arrangement.orders : extractOrderIdsFromBody(text);
    const orderAllow = new Set(orderIds);
    provisions.push(
      ...parseOrderBlocks(text, orderAllow.size > 0 ? orderAllow : undefined).filter(
        isUsableProvision,
      ),
    );

    const scheduleIds =
      arrangement.schedules.length > 0
        ? arrangement.schedules
        : extractScheduleIdsFromBody(text);
    const scheduleAllow = new Set(scheduleIds);
    const existingScheduleIds = new Set(
      provisions.filter((p) => p.provisionType === 'schedule').map((p) => p.provisionId),
    );
    for (const sched of parseScheduleBlocks(text, scheduleAllow.size > 0 ? scheduleAllow : undefined)) {
      if (!isUsableProvision(sched)) continue;
      if (!existingScheduleIds.has(sched.provisionId)) {
        provisions.push(sched);
        existingScheduleIds.add(sched.provisionId);
      }
    }
  }

  const structure = buildActStructureProfile(provisions);
  return {
    provisions,
    structure,
    arrangement,
    quality: { rejectedHeadingOnlySections },
  };
}

/** Convert provisions to legacy ParsedActSection[] for ingest connectors. */
export function provisionsToLegacySections(
  provisions: ParsedActProvision[],
): ParsedActSection[] {
  return provisions.map((p) => ({
    section: provisionToStorageSection(p),
    title: p.title,
    fullText: p.fullText,
    isRepealed: p.isRepealed,
    repealNotes: p.repealNotes,
  }));
}
