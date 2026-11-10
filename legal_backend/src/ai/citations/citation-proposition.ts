/** Keep source annotations attached to their actual Markdown claim. */
export function citationProposition(markdown: string, citation: string): string {
  const index = markdown.toLowerCase().indexOf(citation.toLowerCase());
  if (index < 0) return citation;
  const start = markdown.lastIndexOf('\n', index) + 1;
  const end = markdown.indexOf('\n', index);
  return markdown.slice(Math.max(start, index - 1500), end < 0 ? index + citation.length + 500 : Math.min(end, index + citation.length + 500)).trim();
}
