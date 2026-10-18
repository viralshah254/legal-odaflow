/** Regex patterns for Indian case-law citation detection in queries and output. */
export const IN_CASE_CITATION_PATTERNS: RegExp[] = [
  /\(\d{4}\)\s+\d+\s+SCC\s+\d+/i,
  /\(\d{4}\)\s+\d+\s+SCR\s+\d+/i,
  /AIR\s+\d{4}\s+[A-Za-z]+\s+\d+/i,
  /\d{4}\s*INSC\s*\d+/i,
  /\[\d{4}\]\s+\d+\s+S\.?C\.?R\.?\s+\d+/i,
];

export function normaliseIndiaCitation(citation: string): string {
  return citation
    .replace(/\s+/g, ' ')
    .replace(/[.,;:]/g, '')
    .replace(/\(\s+/g, '(')
    .trim()
    .toUpperCase();
}

export function extractIndiaCitations(text: string): string[] {
  const found = new Set<string>();
  for (const pattern of IN_CASE_CITATION_PATTERNS) {
    const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
    const matches = text.match(re);
    if (matches) matches.forEach((m) => found.add(m.trim()));
  }
  return [...found];
}
