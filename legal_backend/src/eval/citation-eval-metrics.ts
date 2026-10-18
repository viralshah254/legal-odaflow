import { hasFullDate, hasPartyStyleCaseName } from '@/ai/citations/citation-contract';
import { RelevanceVerificationService } from '@/ai/verification/relevance-verification.service';

export interface CitationEvalOutput {
  inputQuery?: string | null;
  outputMarkdown: string;
  citations: CitationEvalEntry[];
}

export interface CitationEvalEntry {
  quotedText?: string | null;
  paragraphRef?: string | null;
  authority?: {
    title?: string | null;
    citation?: string | null;
    neutralCitation?: string | null;
    court?: string | null;
    decisionDate?: string | Date | null;
    summary?: string | null;
    holding?: string | null;
    fullText?: string | null;
    authorityType?: string | null;
    practiceAreas?: unknown;
    topics?: unknown;
  } | null;
}

export interface CitationEvalMetrics {
  citationRelevanceScore: number;
  citationMetadataCompletenessScore: number;
  evaluatedCitations: number;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function normalized(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function quotationSupported(entry: CitationEvalEntry): boolean {
  const quote = normalized(entry.quotedText ?? '');
  if (!quote) return false;
  const authorityText = normalized(
    [
      entry.authority?.holding,
      entry.authority?.summary,
      entry.authority?.fullText,
    ]
      .filter(Boolean)
      .join(' '),
  );
  return authorityText.includes(quote);
}

export function computeCitationEvalMetrics(
  outputs: CitationEvalOutput[],
): CitationEvalMetrics {
  const relevance = new RelevanceVerificationService();
  let relevancePoints = 0;
  let metadataPoints = 0;
  let metadataDimensions = 0;
  let evaluatedCitations = 0;

  for (const output of outputs) {
    for (const entry of output.citations) {
      const authority = entry.authority;
      if (!authority) continue;
      evaluatedCitations += 1;
      const assessment = relevance.assess({
        authority: {
          title: authority.title,
          citation: authority.citation ?? authority.neutralCitation,
          summary: authority.summary ?? authority.holding,
          fullText: authority.fullText,
          practiceAreas: stringArray(authority.practiceAreas),
          topics: stringArray(authority.topics),
        },
        query: `${output.inputQuery ?? ''}\n${entry.quotedText ?? ''}\n${output.outputMarkdown}`,
      });
      relevancePoints +=
        assessment.state === 'GOVERNS' ? 1 : assessment.state === 'RELATED' ? 0.5 : 0;

      const caseAuthority = /case/i.test(authority.authorityType ?? '') ||
        hasPartyStyleCaseName(authority.title);
      const checks = caseAuthority
        ? [
            hasPartyStyleCaseName(authority.title),
            Boolean(authority.court?.trim()),
            hasFullDate(authority.decisionDate),
            Boolean(authority.neutralCitation?.trim() || authority.citation?.trim()),
            Boolean(entry.paragraphRef?.trim()),
            quotationSupported(entry),
          ]
        : [
            Boolean(authority.title?.trim()),
            Boolean(authority.citation?.trim() || authority.neutralCitation?.trim()),
            Boolean(entry.paragraphRef?.trim()),
            quotationSupported(entry),
          ];
      metadataPoints += checks.filter(Boolean).length;
      metadataDimensions += checks.length;
    }
  }

  return {
    citationRelevanceScore:
      evaluatedCitations > 0
        ? Number((relevancePoints / evaluatedCitations).toFixed(4))
        : 1,
    citationMetadataCompletenessScore:
      metadataDimensions > 0
        ? Number((metadataPoints / metadataDimensions).toFixed(4))
        : 1,
    evaluatedCitations,
  };
}

