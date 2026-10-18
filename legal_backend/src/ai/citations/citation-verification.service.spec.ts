import { CitationVerificationService } from './citation-verification.service';
import { RelevanceVerificationService } from '@/ai/verification/relevance-verification.service';

describe('CitationVerificationService hard gate', () => {
  const service = new CitationVerificationService(
    undefined,
    undefined,
    undefined,
    undefined,
    new RelevanceVerificationService(),
  );
  const authority = {
    id: 'case-1',
    title: 'Rao v. National Bank Ltd.',
    citation: '(2024) 1 SCC 10',
    sourceName: 'Supreme Court of India',
    sourceUrl: 'https://example.test/case-1',
    authorityType: 'CASE',
    court: 'Supreme Court of India',
    decisionDate: '15 March 2024',
    jurisdiction: 'IN',
    currentLawStatus: 'GOOD_LAW',
    bindingStatus: 'BINDING',
    paragraph: '42',
    fullText: 'The bank must investigate an unauthorised UPI transaction before refusing reversal.',
    summary: null,
    practiceAreas: ['consumer', 'banking'],
    topics: ['UPI', 'unauthorised transaction'],
  };

  it('returns only fully verified citations as renderable', async () => {
    const result = await service.verifyCitations({
      outputMarkdown:
        'The bank must investigate an unauthorised UPI transaction before refusing reversal, (2024) 1 SCC 10.',
      authorities: [authority],
      countryCode: 'IN',
      query: 'consumer banking unauthorised UPI transaction reversal',
      fastMode: true,
    });

    expect(result.foundCount).toBe(1);
    expect(result.citations).toEqual([
      expect.objectContaining({ found: true, verified: true, citation: '(2024) 1 SCC 10' }),
    ]);
    expect(result.rejectedCitations).toEqual([]);
    expect(result.safeForReliance).toBe(true);
  });

  it('exposes a found but metadata-incomplete case as a verification gap', async () => {
    const result = await service.verifyCitations({
      outputMarkdown:
        'The bank must investigate an unauthorised UPI transaction before refusing reversal, (2024) 1 SCC 10.',
      authorities: [{ ...authority, decisionDate: null }],
      countryCode: 'IN',
      query: 'consumer banking unauthorised UPI transaction reversal',
      fastMode: true,
    });

    expect(result.foundCount).toBe(1);
    expect(result.citations).toEqual([]);
    expect(result.rejectedCitations).toHaveLength(1);
    expect(result.verificationGaps?.[0].reasons.join(' ')).toContain('judgment date');
    expect(result.safeForReliance).toBe(false);
  });

  it('never marks citation-free output safe for reliance', async () => {
    const result = await service.verifyCitations({
      outputMarkdown: 'The answer contains no legal citation.',
      authorities: [authority],
      countryCode: 'IN',
      query: 'consumer banking unauthorised UPI transaction reversal',
      fastMode: true,
    });

    expect(result.citations).toEqual([]);
    expect(result.verified).toBe(false);
    expect(result.safeForReliance).toBe(false);
  });
});
