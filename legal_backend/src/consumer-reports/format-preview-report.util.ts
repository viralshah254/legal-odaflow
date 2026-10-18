import type { DraftingIntakeStructuredOutput, FirmIntakeStructuredOutput } from '@/ai/ai-gateway.service';
import { CONSUMER_DISCLAIMER } from '@/ai/constants';
import { LEGAL_REPORT_SECTIONS } from './legal-report-sections.constants';

function stripJsonBlock(markdown: string): string {
  return markdown.replace(/```json\s*[\s\S]*?```/gi, '').trim();
}

function bullets(items: string[]): string {
  if (!items.length) return '';
  return items.map((item) => `- ${item}`).join('\n');
}

function extractNumberedSections(markdown: string): Map<string, string> {
  const map = new Map<string, string>();
  const body = stripJsonBlock(markdown);
  const pattern =
    /(?:^|\n)(?:#{1,3}\s*)?(\d+)\.\s*([^\n]+)\n([\s\S]*?)(?=\n(?:#{1,3}\s*)?\d+\.\s|\n##\s|$)/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(body)) !== null) {
    const title = match[2].trim().toLowerCase();
    const content = match[3].trim();
    if (content) map.set(title, content);
  }
  return map;
}

function fromNumbered(
  numbered: Map<string, string>,
  ...searchTerms: string[]
): string {
  for (const [title, body] of numbered.entries()) {
    if (searchTerms.some((term) => title.includes(term.toLowerCase()))) {
      return body;
    }
  }
  return '';
}

export function formatPreviewReportMarkdown(params: {
  outputMarkdown: string;
  structuredOutput?: FirmIntakeStructuredOutput | DraftingIntakeStructuredOutput;
  issueType: string;
  title: string;
  countryCode: string;
  jurisdiction?: string;
  facts?: string;
  disclaimer?: string;
}): string {
  const raw = params.structuredOutput;
  // Narrow to litigation-style output only when it has `legalIssues`
  const structured = raw && 'legalIssues' in raw ? (raw as FirmIntakeStructuredOutput) : undefined;
  const draftingStructured = raw && 'clauseOutline' in raw ? (raw as DraftingIntakeStructuredOutput) : undefined;
  const situation = structured?.situation ?? draftingStructured?.situation;
  const sourcesCited = structured?.sourcesCited ?? draftingStructured?.sourcesCited ?? [];

  const numbered = extractNumberedSections(params.outputMarkdown);
  const prose = stripJsonBlock(params.outputMarkdown);

  const sectionBodies: Record<string, string> = {
    'Executive Summary':
      situation ||
      fromNumbered(numbered, 'applicable law', 'summary') ||
      prose.split('\n\n')[0]?.slice(0, 1200) ||
      `Preview analysis for "${params.title}" (${params.issueType}).`,
    'Situation Summary':
      situation ||
      params.facts ||
      fromNumbered(numbered, 'applicable law') ||
      '',
    'Legal Issue Classification':
      bullets(structured?.legalIssues ?? []) ||
      `Issue type: ${params.issueType}.`,
    'Jurisdiction Context': params.jurisdiction
      ? `Jurisdiction: ${params.jurisdiction}. Country: ${params.countryCode}.`
      : `Country: ${params.countryCode}. Specify local jurisdiction for tailored guidance.`,
    'Relevant Legal Principles':
      fromNumbered(numbered, 'applicable law', 'legal principles') ||
      prose.slice(0, 2000),
    Strengths: bullets(structured?.strengths ?? []) || fromNumbered(numbered, 'strengths'),
    Risks:
      bullets(structured?.risksAndGaps ?? []) ||
      fromNumbered(numbered, 'risks', 'evidence gaps'),
    'Evidence Needed':
      fromNumbered(numbered, 'missing evidence', 'evidence') ||
      'Gather contracts, correspondence, and proof of performance or breach.',
    Options:
      fromNumbered(numbered, 'options') ||
      'Consider negotiation, formal notice, mediation, or litigation depending on facts and budget.',
    'Suggested Next Steps':
      bullets(structured?.recommendedNextSteps ?? []) ||
      fromNumbered(numbered, 'recommended next steps', 'next steps'),
    'Questions to Ask a Lawyer':
      'What remedies are available? What are filing deadlines? What evidence is essential?',
    'Draft Letter': '',
    'Timeline & Deadlines': 'Confirm limitation periods and notice requirements in your jurisdiction.',
    Sources:
      bullets(sourcesCited) ||
      'See citations attached to this report where available.',
    Disclaimer: params.disclaimer || CONSUMER_DISCLAIMER,
  };

  return LEGAL_REPORT_SECTIONS.map((title) => {
    const body = sectionBodies[title]?.trim() || '';
    return `## ${title}\n\n${body}`;
  }).join('\n\n');
}
