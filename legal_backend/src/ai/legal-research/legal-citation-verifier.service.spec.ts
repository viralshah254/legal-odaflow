import {
  extractCaseCitations,
  extractStatuteCitations,
  LegalCitationVerifierService,
  parseStatuteCitation,
  contextualStatuteAuthority,
} from './legal-citation-verifier.service';
import { RelevanceVerificationService } from '@/ai/verification/relevance-verification.service';
import type { LegalAuthority } from './legal-authority.types';

describe('LegalCitationVerifierService integrity scoring', () => {
  it('resolves shorthand only to an explicit unambiguous Act and an existing subsection', () => {
    const act = { authorityType: 'STATUTE', actName: 'Employment Act', actYear: 2007, section: '35', extractedText: '(1) Notice. (5) Service pay.' } as LegalAuthority;
    expect(contextualStatuteAuthority('section 35(5)', 'Employment Act 2007', [act])).toBe(act);
    expect(contextualStatuteAuthority('section 35(9)', 'Employment Act 2007', [act])).toBeUndefined();
    expect(contextualStatuteAuthority('section 35(5)', 'Companies Act', [act])).toBeUndefined();
    expect(contextualStatuteAuthority('section 35(5)', 'Employment Act', [act, { ...act, actYear: 2024 }])).toBeUndefined();
  });
  it('resolves a referenced section from retained native full-Act passages, never from an excerpt', () => {
    const act = { id: 'whole-act', authorityType: 'STATUTE', title: 'Employment Act, 2007', extractedText: 'Complete Act',
      sourceProvenance: { completeness: 'COMPLETE', documentHash: 'same-native-document' }, sourcePassages: [{ paragraph: 'Section 49', page: 25, sourcePinpoint: true, text: '(1) Remedies. (4) Relevant factors.' }] } as LegalAuthority;
    expect(contextualStatuteAuthority('section 49(4)', 'Employment Act 2007', [act])).toMatchObject({ section: '49', pinpoint: 'Section 49', extractedText: '(1) Remedies. (4) Relevant factors.' });
    expect(contextualStatuteAuthority('section 49(4)', 'Employment Act 2007', [act, { ...act, actName: 'Employment Act, 2007', actYear: 2007, section: '49', extractedText: '(4) Relevant factors.' }])).toBeDefined();
    expect(contextualStatuteAuthority('section 49(9)', 'Employment Act 2007', [act])).toBeUndefined();
    expect(contextualStatuteAuthority('section 49(4)', 'Employment Act 2007', [{ ...act, sourceProvenance: { ...act.sourceProvenance!, completeness: 'EXCERPT' } }])).toBeUndefined();
  });
  const service = new LegalCitationVerifierService(
    {
      legalAuthorityRecord: { findMany: jest.fn().mockResolvedValue([]) },
      legalAuthority: { findMany: jest.fn().mockResolvedValue([]) },
    } as never,
    { lookupExactSection: jest.fn() } as never,
    new RelevanceVerificationService(),
  );

  const completeCase: LegalAuthority = {
    id: 'case-1',
    jurisdiction: 'IN',
    authorityType: 'CASE',
    sourceName: 'Supreme Court of India',
    sourceUrl: 'https://example.test/case-1',
    official: true,
    title: 'Rao v. National Bank Ltd.',
    citation: '(2024) 1 SCC 10',
    court: 'Supreme Court of India',
    decisionDate: '15 March 2024',
    pinpoint: 'paragraph 42',
    extractedText:
      'The bank must investigate an unauthorised UPI transaction before refusing reversal.',
    reliabilityRank: 1,
    bindingStatus: 'BINDING',
    currentLawStatus: 'GOOD_LAW',
    practiceAreas: ['consumer', 'banking'],
    topics: ['UPI', 'unauthorised transaction'],
    sourceProvenance: { provider: 'official-test-fixture', retrievedAt: '2026-11-10T00:00:00.000Z', canonicalIdentity: 'case-1', documentHash: 'a'.repeat(64), pageCount: 1, missingPages: [], completeness: 'COMPLETE', extractionMethod: 'NATIVE_TEXT', authoritativeStatus: 'OFFICIAL', paragraphNumberingIntegrity: 'INTACT', dispositionComplete: true },
  };

  it('keeps a citation attached to a completed sentence, including U.S. punctuation', async () => {
    expect(extractStatuteCitations('347 U.S. 483')).toEqual([]);
    const text = 'Educational opportunity must be made available to all on equal terms.';
    const result = await service.verifyLegalResearchOutput({ markdown: text + ' *(347 U.S. 483, PDF p. 11)*', authorities: [{ ...completeCase, jurisdiction: 'US', title: 'Brown v Board of Education', citation: '347 U.S. 483', court: 'Supreme Court of the United States', extractedText: text, currentLawStatus: 'UNKNOWN', practiceAreas: [], topics: [] }], jurisdiction: 'US', taskType: 'legal_research', query: 'Educational opportunity on equal terms' });
    expect(result.citations).toEqual([expect.objectContaining({ citation: '347 U.S. 483', sourceVerified: true })]);
    expect(result.verifiedMarkdown).not.toContain('Proposition withheld');
  });

  it('does not fully verify metadata without complete source provenance', async () => {
    const result = await service.verifyLegalResearchOutput({ markdown: completeCase.extractedText + ' (2024) 1 SCC 10.', authorities: [{ ...completeCase, sourceProvenance: undefined }], jurisdiction: 'IN', taskType: 'legal_research', query: 'UPI bank transaction reversal' });
    expect(result.citations).toEqual([]);
    expect(result.safeForReliance).toBe(false);
    expect(result.rejectedCitations?.[0]?.missingReasons.join(' ')).toContain('Source provenance is missing');
  });

  it('separates found identity from fully verified citations', async () => {
    const result = await service.verifyLegalResearchOutput({
      markdown:
        'The bank must investigate an unauthorised UPI transaction before refusing reversal, (2024) 1 SCC 10.',
      authorities: [{ ...completeCase, decisionDate: undefined }],
      jurisdiction: 'IN',
      taskType: 'legal_research',
      query: 'consumer banking unauthorised UPI transaction reversal',
      legalDomain: 'consumer banking',
    });

    expect(result.foundCitationCount).toBe(1);
    expect(result.verifiedCitationCount).toBe(0);
    expect(result.citations).toEqual([]);
    expect(result.rejectedCitations).toHaveLength(1);
    expect(result.safeForReliance).toBe(false);
    expect(result.verifiedMarkdown).not.toContain('(2024) 1 SCC 10');
    expect(result.verifiedMarkdown).toContain('Proposition withheld');
  });

  it('admits a complete case only when all core checks pass', async () => {
    const result = await service.verifyLegalResearchOutput({
      markdown:
        'The bank must investigate an unauthorised UPI transaction before refusing reversal, (2024) 1 SCC 10.',
      authorities: [completeCase],
      jurisdiction: 'IN',
      taskType: 'legal_research',
      query: 'consumer banking unauthorised UPI transaction reversal',
      legalDomain: 'consumer banking',
    });

    expect(result.foundCitationCount).toBe(1);
    expect(result.verifiedCitationCount).toBe(1);
    expect(result.citations).toEqual([
      expect.objectContaining({ citation: '(2024) 1 SCC 10', found: true, verified: true }),
    ]);
    expect(result.rejectedCitations).toEqual([]);
    expect(result.safeForReliance).toBe(true);
    expect(result.verifiedMarkdown).toContain('(2024) 1 SCC 10');
  });

  it('parses Kenya constitutional, Cap, Act, Legal Notice, eKLR, and neutral citations', () => {
    const statutes = extractStatuteCitations(
      'Article 47(1) of the Constitution of Kenya; Data Protection Act, 2019, Cap. 411C, section 25(a); Legal Notice No. 117 of 2020 section 4.',
    );
    const cases = extractCaseCitations(
      'Example v State [2024] KESC 12 (KLR) at paragraph 42; Other v Board [2020] eKLR [17].',
    );

    expect(statutes).toEqual(expect.arrayContaining([
      expect.stringContaining('Article 47(1)'),
      expect.stringContaining('Cap. 411C'),
      expect.stringContaining('Legal Notice No. 117'),
    ]));
    expect(parseStatuteCitation(statutes[0])).toEqual(expect.objectContaining({
      actName: 'Constitution of Kenya',
      actYear: 2010,
      section: '47(1)',
    }));
    expect(cases).toEqual(expect.arrayContaining([
      expect.stringContaining('[2024] KESC 12'),
      expect.stringContaining('[2020] eKLR'),
    ]));
  });

  it('returns paragraph deep links for fully verified Kenya cases', async () => {
    const authority: LegalAuthority = {
      ...completeCase,
      id: 'ke-case-1',
      jurisdiction: 'KE',
      title: 'Example v State',
      citation: '[2024] KESC 12 (KLR)',
      neutralCitation: '[2024] KESC 12',
      court: 'Supreme Court of Kenya',
      decisionDate: '15 March 2024',
      pinpoint: undefined,
      sourceUrl: 'https://new.kenyalaw.org/akn/ke/judgment/kesc/2024/12/eng@2024-03-15',
      deepLinkUrl: 'https://new.kenyalaw.org/akn/ke/judgment/kesc/2024/12/eng@2024-03-15#para-42',
      extractedText: 'The court held that constitutional due process requires a fair hearing.',
    };
    const result = await service.verifyLegalResearchOutput({
      markdown:
        'Constitutional due process requires a fair hearing, Example v State [2024] KESC 12 (KLR) at paragraph 42.',
      authorities: [authority],
      jurisdiction: 'KE',
      taskType: 'legal_research',
      query: 'constitutional due process fair hearing',
      legalDomain: 'constitutional',
    });

    expect(result.kenyaVerified).toBe(true);
    expect(result.citations).toEqual([
      expect.objectContaining({
        pinpoint: 'paragraph 42',
        deepLinkUrl: expect.stringContaining('#para-42'),
      }),
    ]);
  });

  it('excludes prospective Kenya authorities from verified support', async () => {
    const result = await service.verifyLegalResearchOutput({
      markdown:
        'A future rule applies, Example v State [2024] KESC 12 (KLR) at paragraph 42.',
      authorities: [{
        ...completeCase,
        jurisdiction: 'KE',
        title: 'Example v State',
        citation: '[2024] KESC 12 (KLR)',
        court: 'Supreme Court of Kenya',
        sourceClass: 'OFFICIAL_PROSPECTIVE',
        deepLinkUrl: 'https://new.kenyalaw.org/example#para-42',
      }],
      jurisdiction: 'KE',
      taskType: 'legal_research',
      query: 'future rule',
    });

    expect(result.kenyaVerified).toBe(false);
    expect(result.rejectedCitations?.[0]?.missingReasons.join(' ')).toContain(
      'Prospective authority cannot establish law in force',
    );
  });
});
