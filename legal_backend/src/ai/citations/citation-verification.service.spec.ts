import { CitationVerificationService, type CitationAuthority } from './citation-verification.service';
import { RelevanceVerificationService } from '@/ai/verification/relevance-verification.service';

describe('CitationVerificationService hard gate', () => {
  const service = new CitationVerificationService(
    undefined,
    undefined,
    undefined,
    undefined,
    new RelevanceVerificationService(),
  );
  const authority: CitationAuthority = {
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
    sourceProvenance: { provider: 'official-test-fixture', retrievedAt: '2026-11-10T00:00:00.000Z', canonicalIdentity: 'case-1', documentHash: 'a'.repeat(64), pageCount: 1, missingPages: [], completeness: 'COMPLETE', extractionMethod: 'NATIVE_TEXT', authoritativeStatus: 'OFFICIAL', paragraphNumberingIntegrity: 'INTACT', dispositionComplete: true },
  };

  it('rejects a metadata-only authority without a complete source record', async () => {
    const result = await service.verifyCitations({ outputMarkdown: authority.fullText + ' (2024) 1 SCC 10.', authorities: [{ ...authority, sourceProvenance: undefined }], countryCode: 'IN', query: 'UPI bank transaction reversal', fastMode: true });
    expect(result.citations).toEqual([]);
    expect(result.safeForReliance).toBe(false);
  });

  it('verifies a source annotation after the completed sentence in a U.S. opinion', async () => {
    const text = 'Educational opportunity must be available on equal terms.';
    const result = await service.verifyCitations({ outputMarkdown: text + ' *(347 U.S. 483, PDF p. 11)*', authorities: [{ ...authority, title: 'Brown v Board of Education', citation: '347 U.S. 483', jurisdiction: 'US', court: 'Supreme Court of the United States', fullText: text, currentLawStatus: 'UNKNOWN', practiceAreas: [], topics: [] }], countryCode: 'US', query: text, fastMode: true });
    expect(result.citations).toEqual([expect.objectContaining({ sourceVerified: true, verified: false })]);
  });

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

describe('Source verification is distinct from current-law certification', () => {
  it('retains a source-checked official citation with an explicit current-law warning and no safe-for-reliance badge', async () => {
    const service = new CitationVerificationService(undefined, undefined, undefined, undefined, new RelevanceVerificationService());
    const result = await service.verifyCitations({
      outputMarkdown: 'An employee voluntary resignation is not statutory retrenchment, AIR 1990 SC 1808.',
      countryCode: 'IN', query: 'employee voluntary resignation statutory retrenchment', fastMode: true,
      authorities: [{ id: 'official-case', title: 'Employer v Employee', citation: 'AIR 1990 SC 1808', sourceName: 'Supreme Court of India', sourceUrl: 'https://api.sci.gov.in/judgment.pdf',
        authorityType: 'CASE', court: 'Supreme Court of India', decisionDate: '1990-07-27', jurisdiction: 'IN', bindingStatus: 'BINDING', page: 8,
        fullText: '1990 AIR 1808. We hold that an employee voluntary resignation is not statutory retrenchment.',
        sourceProvenance: { provider: 'Supreme Court of India', retrievedAt: new Date().toISOString(), documentHash: 'public-source-hash', pageCount: 9, missingPages: [], completeness: 'COMPLETE', extractionMethod: 'NATIVE_TEXT', authoritativeStatus: 'OFFICIAL', paragraphNumberingIntegrity: 'UNKNOWN', dispositionComplete: true },
      }],
    });
    expect(result.citations[0]).toMatchObject({ sourceVerified: true, currentLawVerified: false, verified: false });
    expect(result.safeForReliance).toBe(false);
    expect(result.warnings.join(' ')).toMatch(/current law remains unverified/);
  });
});
