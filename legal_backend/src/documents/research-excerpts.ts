/** Local retrieval over authorized decrypted text. Offsets refer to extracted
 * text, not PDF page numbers; never manufacture a page citation. */
export function researchExcerpt(text: string, query: string | undefined, budget: number): string {
  if (budget <= 0) return '';
  if (text.length <= budget) return text;
  const terms = [...new Set((query?.toLocaleLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? [])
    .filter((term) => !new Set(['the', 'and', 'for', 'what', 'this', 'that', 'with', 'from', 'about', 'which', 'does', 'have']).has(term)))];
  if (terms.length === 0) return text.slice(0, budget);
  const width = Math.min(1600, Math.max(240, Math.floor(budget / 2)));
  const candidates: Array<{ start: number; end: number; score: number }> = [];
  for (let start = 0; start < text.length; start += Math.max(1, width - 160)) {
    const end = Math.min(text.length, start + width);
    const chunk = text.slice(start, end).toLocaleLowerCase();
    const score = terms.reduce((total, term) => total + (chunk.includes(term) ? 1 : 0), 0);
    candidates.push({ start, end, score });
  }
  // Outcome questions need the dispositive ending even when repeated issue words
  // give earlier passages a higher lexical score. Keep the normal source offsets.
  if (/\b(outcome|disposition|relief|final order|final decision|appeal allowed|appeal dismissed)\b/i.test(query ?? '')) {
    candidates.unshift({ start: Math.max(0, text.length - width), end: text.length, score: Number.MAX_SAFE_INTEGER });
  }
  const chosen: typeof candidates = [];
  let remaining = budget;
  for (const candidate of candidates.sort((a, b) => b.score - a.score || a.start - b.start)) {
    if (chosen.some((other) => candidate.start < other.end && candidate.end > other.start)) continue;
    const anchor = `[Extracted text characters ${candidate.start + 1}-${candidate.end}]\n`;
    if (remaining <= anchor.length + 20) break;
    const end = Math.min(candidate.end, candidate.start + remaining - anchor.length - 2);
    chosen.push({ ...candidate, end });
    remaining -= anchor.length + end - candidate.start + 2;
    if (chosen.length >= 3) break;
  }
  return chosen.sort((a, b) => a.start - b.start)
    .map(({ start, end }) => `[Extracted text characters ${start + 1}-${end}]\n${text.slice(start, end)}`)
    .join('\n\n').slice(0, budget);
}
