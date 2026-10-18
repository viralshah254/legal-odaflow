import { checkDomainCompleteness } from '@/ai/legal-research/domain-completeness-checker';
import { CITATION_DISCIPLINE_PROMPT } from '@/ai/legal-research/research-prompt-blocks';
import { RelevanceVerificationService } from '@/ai/verification/relevance-verification.service';
import { computeCitationEvalMetrics } from './citation-eval-metrics';
import { UmbrellaLegalEvalHarness } from './umbrella-legal-eval.harness';
import {
  UPI_CITATION_EVAL_OUTPUT,
  UPI_GOLDEN_RESEARCH_OUTPUT,
  UPI_OFF_POINT_AUTHORITIES,
  UPI_REGRESSION_QUERY,
} from './upi-legal-research-golden.fixture';

describe('unauthorised UPI legal-research regression', () => {
  const relevance = new RelevanceVerificationService();

  it('rejects PMLA s.11, CPC s.35 and RERA s.40 as off-point', () => {
    for (const authority of UPI_OFF_POINT_AUTHORITIES) {
      expect(
        relevance.assess({
          authority,
          query: UPI_REGRESSION_QUERY,
          legalDomain: 'CONSUMER',
        }).state,
      ).toBe('OFF_POINT');
    }
  });

  it('keeps BSA electronic-evidence and CPA complaint authorities relevant', () => {
    for (const citation of UPI_CITATION_EVAL_OUTPUT.citations) {
      const result = relevance.assess({
        authority: {
          title: citation.authority?.title,
          citation: citation.authority?.citation,
          fullText: citation.authority?.fullText,
          summary: citation.authority?.summary,
          practiceAreas: Array.isArray(citation.authority?.practiceAreas)
            ? citation.authority.practiceAreas.filter(
                (value): value is string => typeof value === 'string',
              )
            : undefined,
          topics: Array.isArray(citation.authority?.topics)
            ? citation.authority.topics.filter(
                (value): value is string => typeof value === 'string',
              )
            : undefined,
        },
        query: `${citation.quotedText ?? ''} ${citation.authority?.title ?? ''}`,
        legalDomain: 'CONSUMER',
      });
      expect(result.state).not.toBe('OFF_POINT');
    }
  });

  it('covers every required banking, forum, responsibility and conduct item', () => {
    expect(
      checkDomainCompleteness({
        query: UPI_REGRESSION_QUERY,
        outputMarkdown: UPI_GOLDEN_RESEARCH_OUTPUT,
        countryCode: 'IN',
      }),
    ).toEqual([]);
  });

  it('emits structured checklist_unmet retrieval gaps for omissions', () => {
    const gaps = checkDomainCompleteness({
      query: UPI_REGRESSION_QUERY,
      outputMarkdown: 'The customer should ask the bank to investigate.',
      countryCode: 'IN',
    });
    expect(gaps.length).toBeGreaterThanOrEqual(7);
    expect(gaps.every((gap) => gap.finding.checkId.startsWith('checklist_unmet:'))).toBe(
      true,
    );
    expect(gaps.every((gap) => gap.finding.dimension === 'coverage')).toBe(true);
    expect(gaps.every((gap) => gap.finding.repairAction === 'RETRIEVE')).toBe(true);
  });

  it('enforces verified-case metadata and actually-decided proposition rules', () => {
    expect(CITATION_DISCIPLINE_PROMPT).toMatch(/case name\/parties/i);
    expect(CITATION_DISCIPLINE_PROMPT).toMatch(/full judgment date/i);
    expect(CITATION_DISCIPLINE_PROMPT).toMatch(/neutral citation where one is available/i);
    expect(CITATION_DISCIPLINE_PROMPT).toMatch(/precise relevant paragraph\/pinpoint/i);
    expect(CITATION_DISCIPLINE_PROMPT).toMatch(/actually decided/i);
    expect(CITATION_DISCIPLINE_PROMPT).toMatch(/must not be presented as verified/i);
  });

  it('computes citation relevance and metadata scores from citation output', () => {
    const complete = computeCitationEvalMetrics([UPI_CITATION_EVAL_OUTPUT]);
    const incomplete = computeCitationEvalMetrics([
      {
        ...UPI_CITATION_EVAL_OUTPUT,
        citations: UPI_CITATION_EVAL_OUTPUT.citations.map((citation) => ({
          ...citation,
          paragraphRef: undefined,
          quotedText: 'Unsupported proposition text.',
        })),
      },
    ]);

    expect(complete.citationRelevanceScore).toBeGreaterThan(0);
    expect(complete.citationMetadataCompletenessScore).toBe(1);
    expect(incomplete.citationMetadataCompletenessScore).toBeLessThan(
      complete.citationMetadataCompletenessScore,
    );
  });

  it('reports computed citation scores through the golden harness', () => {
    const harness = new UmbrellaLegalEvalHarness(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const result = harness.runUpiResearchRegressionBenchmark();

    expect(result.passed).toBe(true);
    expect(result.citationRelevanceScore).toBeGreaterThan(0);
    expect(result.citationMetadataCompletenessScore).toBe(1);
  });
});

