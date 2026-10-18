import { LEGAL_REPORT_SECTIONS } from './legal-report-sections.constants';

export function parseReportSectionsMarkdown(markdown: string): Map<string, string> {
  const sections = new Map<string, string>();
  if (!markdown?.trim()) return sections;

  const parts = markdown.split(/\n(?=## )/).filter((p) => p.trim());
  for (const part of parts) {
    const match = part.match(/^##\s+(.+?)(?:\n|$)([\s\S]*)/);
    if (!match) continue;
    const title = match[1].trim();
    const content = match[2].trim();
    sections.set(title, content);
  }
  return sections;
}

export function mergeSectionIntoReportMarkdown(
  markdown: string,
  sectionTitle: string,
  body: string,
): string {
  const map = parseReportSectionsMarkdown(markdown);
  map.set(sectionTitle, body.trim());
  return LEGAL_REPORT_SECTIONS.map((title) => {
    const content = map.get(title)?.trim() ?? '';
    return `## ${title}\n\n${content}`;
  }).join('\n\n');
}

export function listEmptyReportSections(markdown: string): string[] {
  const map = parseReportSectionsMarkdown(markdown);
  return LEGAL_REPORT_SECTIONS.filter((title) => !(map.get(title)?.trim()));
}
