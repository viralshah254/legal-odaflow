import type { StatuteSectionFetchResult } from '../connectors/us-code.connector';

function stripTags(value: string): string {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function extractBlockText(block: string): string {
  const paragraphs = [...block.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map((match) =>
    stripTags(match[1]),
  );
  if (paragraphs.length > 0) {
    return paragraphs.join('\n\n');
  }
  return stripTags(block);
}

function extractNum(block: string): string | undefined {
  const numMatch = block.match(/<num[^>]*>([\s\S]*?)<\/num>/i);
  if (!numMatch) return undefined;
  return stripTags(numMatch[1]).replace(/\.$/, '');
}

function extractHeading(block: string): string | undefined {
  const headingMatch = block.match(/<heading[^>]*>([\s\S]*?)<\/heading>/i);
  if (!headingMatch) return undefined;
  const heading = stripTags(headingMatch[1]);
  return heading || undefined;
}

function sectionSourceUrl(baseSourceUrl: string, section: string, eId?: string): string {
  const anchor = eId ? `#${eId}` : `#sec_${section}`;
  return `${baseSourceUrl.replace(/#.*$/, '')}${anchor}`;
}

/**
 * Parse top-level Akoma Ntoso section/article elements into statute sections.
 */
export function parseAkomaNtosoSections(
  xml: string,
  baseSourceUrl: string,
): StatuteSectionFetchResult[] {
  const sections: StatuteSectionFetchResult[] = [];
  const seen = new Set<string>();

  const blockRegex = /<(section|article)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;

  while ((match = blockRegex.exec(xml)) !== null) {
    const attrs = match[2] ?? '';
    const block = match[3] ?? '';
    const eId = attrs.match(/\beId="([^"]+)"/i)?.[1];

    const num = extractNum(block);
    if (!num) continue;

    const heading = extractHeading(block);
    const fullText = extractBlockText(block);
    if (fullText.length < 8) continue;

    const sectionKey = num.toLowerCase();
    if (seen.has(sectionKey)) continue;
    seen.add(sectionKey);

    const title = heading ? `Section ${num} — ${heading}` : `Section ${num}`;
    sections.push({
      section: num,
      title,
      summary: fullText.slice(0, 400),
      fullText,
      sourceUrl: sectionSourceUrl(baseSourceUrl, num, eId),
      sourceName: 'Laws.Africa / Kenya Law',
    });
  }

  return sections;
}
