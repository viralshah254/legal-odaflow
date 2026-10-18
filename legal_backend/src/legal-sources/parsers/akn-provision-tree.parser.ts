import type { KenyaProvisionInput } from '../kenya-corpus.types';

const ELEMENT_TYPES = [
  'section',
  'article',
  'subsection',
  'paragraph',
  'subparagraph',
  'proviso',
  'schedule',
] as const;

type ElementType = (typeof ELEMENT_TYPES)[number];

interface OpenElement {
  tagType: ElementType;
  type: ElementType;
  key: string;
  parentKey?: string;
  contentStart: number;
  ordinal: number;
}

/**
 * Lightweight structural parser shared by AKN XML and Kenya Law's AKN HTML.
 * It retains nested provision identity without depending on browser DOM APIs.
 */
export function parseAknProvisionTree(content: string): KenyaProvisionInput[] {
  const typePattern = ELEMENT_TYPES.join('|');
  const tokenRegex = new RegExp(`<(/?)(${typePattern})\\b([^>]*)>`, 'gi');
  const stack: OpenElement[] = [];
  const provisions: KenyaProvisionInput[] = [];
  let ordinal = 0;
  let token: RegExpExecArray | null;

  while ((token = tokenRegex.exec(content)) !== null) {
    const closing = token[1] === '/';
    const tagType = token[2].toLowerCase() as ElementType;
    if (!closing) {
      const attrs = token[3] ?? '';
      const type = semanticType(tagType, attrs);
      const parentKey = stack.at(-1)?.key;
      const sourceId =
        attrs.match(/\b(?:eId|id)="([^"]+)"/i)?.[1] ??
        `${parentKey ?? 'root'}:${type}:${ordinal}`;
      stack.push({
        tagType,
        type,
        key: sourceId,
        parentKey,
        contentStart: tokenRegex.lastIndex,
        ordinal: ordinal++,
      });
      continue;
    }

    const openIndex = findLastIndex(stack, (entry) => entry.tagType === tagType);
    if (openIndex < 0) continue;
    const [open] = stack.splice(openIndex, 1);
    const block = content.slice(open.contentStart, token.index);
    const label = extractTagText(block, 'num');
    const heading = extractTagText(block, 'heading');
    const text = stripMarkup(block);
    if (text.length < 2) continue;
    provisions.push({
      provisionKey: open.key,
      provisionType: open.type.toUpperCase(),
      label,
      heading,
      parentProvisionKey: open.parentKey,
      ordinal: open.ordinal,
      text,
      citationSafeText: text,
      sourceAnchor: `#${open.key}`,
    });
  }

  return provisions.sort((a, b) => a.ordinal - b.ordinal);
}

function semanticType(tagType: ElementType, attrs: string): ElementType {
  if (tagType !== 'section') return tagType;
  if (/\bakn-subsection\b/i.test(attrs)) return 'subsection';
  if (/\bakn-paragraph\b/i.test(attrs)) return 'paragraph';
  if (/\bakn-subparagraph\b/i.test(attrs)) return 'subparagraph';
  return tagType;
}

function extractTagText(block: string, tag: string): string | undefined {
  const match = block.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  const value = match ? stripMarkup(match[1]) : '';
  return value || undefined;
}

function stripMarkup(value: string): string {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function findLastIndex<T>(items: T[], predicate: (item: T) => boolean): number {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (predicate(items[index])) return index;
  }
  return -1;
}
