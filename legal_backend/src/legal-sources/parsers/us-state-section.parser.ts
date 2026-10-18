/**
 * Extract statutory section body text from FindLaw / Cornell LII HTML pages.
 */

/** Strip HTML tags and collapse whitespace. */
export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parse full section text from a FindLaw section page HTML body.
 * Returns undefined when the page looks like an index rather than section content.
 */
export function parseUsStateSectionHtml(html: string, section: string): string | undefined {
  const cleaned = stripHtml(html);
  if (!cleaned || cleaned.length < 80) return undefined;

  // Index pages list many sections — reject if too many section-number patterns
  const sectionRefMatches = cleaned.match(/\bSection\s+\d+/gi) ?? [];
  if (sectionRefMatches.length > 6 && cleaned.length < 2000) {
    return undefined;
  }

  const sectionPatterns = [
    new RegExp(`§\\s*${section.replace('.', '\\.')}\\s*[.—:-]\\s*([\\s\\S]{80,8000})`, 'i'),
    new RegExp(`Section\\s+${section.replace('.', '\\.')}\\s*[.—:-]\\s*([\\s\\S]{80,8000})`, 'i'),
  ];

  for (const pattern of sectionPatterns) {
    const match = cleaned.match(pattern);
    if (match?.[1]) {
      const body = match[1].trim().slice(0, 6000);
      if (body.length >= 80) return body;
    }
  }

  // Fallback: use main content region text if substantial
  const mainMatch = html.match(/<main[\s\S]*?>([\s\S]*?)<\/main>/i);
  const articleMatch = html.match(/<article[\s\S]*?>([\s\S]*?)<\/article>/i);
  const candidate = stripHtml(mainMatch?.[1] ?? articleMatch?.[1] ?? html);
  if (candidate.length >= 40 && candidate.length <= 8000) {
    return candidate;
  }

  return undefined;
}

/** Parse section index links from a FindLaw code index page. */
export function parseUsStateSectionLinks(
  html: string,
  baseUrl: string,
): Array<{ section: string; title: string; href: string }> {
  const links: Array<{ section: string; title: string; href: string }> = [];
  const seen = new Set<string>();

  const patterns = [
    /href="([^"]*\/section-(\d+(?:\.\d+)?[a-zA-Z]?)\/?[^"]*)"[^>]*>([^<]{3,200})/gi,
    /href="([^"]*(?:section|sec)[^"]*\/(\d+(?:\.\d+)?[a-zA-Z]?)[^"]*)"[^>]*>([^<]{3,200})/gi,
    /href="([^"]*#(?:section|sec)[^"]*)"[^>]*>([^<]{3,200})/gi,
  ];

  for (const re of patterns) {
    let match: RegExpExecArray | null;
    while ((match = re.exec(html)) !== null) {
      const section = match[2] ?? match[1].match(/(\d+(?:\.\d+)?[a-zA-Z]?)/)?.[1];
      if (!section) continue;
      const key = section.toUpperCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const title = (match[3] ?? match[2] ?? '').trim().replace(/\s+/g, ' ');
      const href = match[1].startsWith('http')
        ? match[1]
        : new URL(match[1], baseUrl).href;
      links.push({ section, title, href });
    }
  }

  return links;
}
