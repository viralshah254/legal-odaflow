/**
 * Extract every Act/section the user named — lists, parentheticals, and
 * "Provision: Section 480 BNSS" labels — so research can pin them.
 */

const SECTION_NUM = String.raw`\d+[A-Za-z]?(?:\(\d+[A-Za-z]?\))*`;

const ACT_ALIASES: Array<{ pattern: RegExp; queryAct: string }> = [
  { pattern: /\bbnss\b|bharatiya\s+nagarik\s+suraksha/i, queryAct: 'BNSS' },
  { pattern: /\bbns\b|bharatiya\s+nyaya/i, queryAct: 'BNS' },
  { pattern: /\bbsa\b|bharatiya\s+sakshya/i, queryAct: 'BSA' },
  { pattern: /\bcr\.?\s*p\.?\s*c\.?|code of criminal procedure/i, queryAct: 'CrPC' },
  { pattern: /\bipc\b|indian penal code/i, queryAct: 'IPC' },
  { pattern: /\bcpc\b|code of civil procedure/i, queryAct: 'CPC' },
  { pattern: /\bni\s*act|negotiable instruments/i, queryAct: 'NI Act' },
  { pattern: /\btransfer of property|tpa\b/i, queryAct: 'Transfer of Property Act' },
  { pattern: /\bconsumer protection/i, queryAct: 'Consumer Protection Act' },
  { pattern: /\bcontract act|indian contract/i, queryAct: 'Contract Act' },
  { pattern: /\bspecific relief/i, queryAct: 'Specific Relief Act' },
  { pattern: /\bconstitution\b/i, queryAct: 'Constitution' },
];

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.replace(/\s+/g, ' ').trim()).filter(Boolean))];
}

function aliasAct(raw: string): string {
  const trimmed = raw.replace(/,?\s*\d{4}\s*$/, '').trim();
  for (const { pattern, queryAct } of ACT_ALIASES) {
    if (pattern.test(trimmed)) return queryAct;
  }
  return trimmed.replace(/\s+/g, ' ').slice(0, 80);
}

function splitSectionList(blob: string): string[] {
  return blob
    .split(/\s*(?:,\s*and\s+|,\s*|\s+and\s+|&)\s*/i)
    .map((part) => part.trim())
    .filter((part) => new RegExp(`^${SECTION_NUM}$`, 'i').test(part));
}

/** Section-finder / on-demand tokens, e.g. `480 BNSS`, `115(2) BNS`, `106 Transfer of Property Act`. */
export function extractNamedStatuteQueries(text: string): string[] {
  if (!text.trim()) return [];
  const queries: string[] = [];

  const listWithAct = new RegExp(
    String.raw`sections?\s+((?:${SECTION_NUM}(?:\s*,\s*(?:and\s+)?|\s+and\s+))+${SECTION_NUM})\s+(?:of\s+)?(?:the\s+)?([A-Z][A-Za-z.'\s-]+?(?:Act|Code|Sanhita|Rules|Regulations|Constitution)|BNSS|BNS|BSA|IPC|CrPC|CPC|TPA)`,
    'gi',
  );
  for (const match of text.matchAll(listWithAct)) {
    const act = aliasAct(match[2] ?? '');
    for (const section of splitSectionList(match[1] ?? '')) {
      queries.push(`${section} ${act}`);
    }
  }

  const codeFirst = new RegExp(
    String.raw`\b(BNSS|BNS|BSA|IPC|CrPC|CRPC|CPC|TPA|NI\s*Act|NDPS|POCSO|PMLA|IBC)\s*(?:§|s\.?|section\s*)?(${SECTION_NUM})`,
    'gi',
  );
  for (const match of text.matchAll(codeFirst)) {
    const act = (match[1] ?? '').replace(/CRPC/i, 'CrPC').replace(/\s+/g, ' ');
    queries.push(`${match[2]} ${act}`);
  }

  const numberThenCode = new RegExp(
    String.raw`\b(${SECTION_NUM})\s+(BNSS|BNS|BSA|IPC|CrPC|CRPC|CPC|TPA|NI\s*Act)\b`,
    'gi',
  );
  for (const match of text.matchAll(numberThenCode)) {
    const act = (match[2] ?? '').replace(/CRPC/i, 'CrPC');
    queries.push(`${match[1]} ${act}`);
  }

  const sectionThenAct = new RegExp(
    String.raw`(?:section|article|rule|s\.|§)\s*(${SECTION_NUM})\s+(?:of\s+)?(?:the\s+)?([A-Z][A-Za-z.'\s-]+?(?:Act|Code|Sanhita|Rules|Regulations|Constitution)|BNSS|BNS|BSA|IPC|CrPC|CPC|TPA)`,
    'gi',
  );
  for (const match of text.matchAll(sectionThenAct)) {
    queries.push(`${match[1]} ${aliasAct(match[2] ?? '')}`);
  }

  const provisionLabel = new RegExp(
    String.raw`(?:provision|law|statute)\s*:\s*(?:section\s+)?(${SECTION_NUM})\s+(BNSS|BNS|BSA|IPC|CrPC|CPC|TPA|NI\s*Act|[A-Z][A-Za-z.'\s-]+?(?:Act|Code|Sanhita))`,
    'gi',
  );
  for (const match of text.matchAll(provisionLabel)) {
    queries.push(`${match[1]} ${aliasAct(match[2] ?? '')}`);
  }

  const articles = text.matchAll(/\barticle\s+(\d+[A-Za-z]?)\b/gi);
  for (const match of articles) {
    queries.push(`Article ${match[1]}`);
  }

  return unique(queries);
}

/** Human-readable statute references for the research normalizer. */
export function extractNamedStatuteLabels(text: string): string[] {
  return extractNamedStatuteQueries(text).map((token) =>
    /^article\s+/i.test(token) ? token : `Section ${token}`,
  );
}
