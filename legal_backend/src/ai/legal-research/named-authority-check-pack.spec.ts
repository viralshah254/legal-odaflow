import {
  focusNamedCaseEvidence,
  AUTHORITY_GAP_MARKER,
  extractNamedCaseTitles,
  filterAuthoritiesToCheckPack,
  hasNamedStatuteCheck,
  isQuoteableCaseAuthority,
  shouldSkipInventingHops,
  stripOutputToCheckPack,
} from './named-authority-check-pack';
import type { RetrievedAuthority } from '@/legal-search/legal-retrieval.types';

function statute(partial: Partial<RetrievedAuthority> & { id: string; title: string }): RetrievedAuthority {
  return {
    citation: partial.citation ?? 'BNSS §480',
    sourceName: 'India Section Finder',
    summary: null,
    sourceUrl: null,
    sourceTier: 'primary',
    authorityType: 'STATUTE',
    ...partial,
  };
}

function caseAuth(partial: Partial<RetrievedAuthority> & { id: string; title: string }): RetrievedAuthority {
  return {
    citation: partial.citation ?? null,
    sourceName: partial.sourceName ?? 'e-SCR',
    summary: partial.summary ?? null,
    sourceUrl: partial.sourceUrl ?? null,
    sourceTier: 'case_law',
    authorityType: 'CASE',
    fullText: partial.fullText ?? null,
    ...partial,
  };
}

describe('named-authority-check-pack', () => {
  it('keeps a named decision separate from another case and a later same-party decision', () => {
    const target = caseAuth({ id: 'target', title: 'Kenfreight (E.A.) Limited v Benson K. Nguti', decisionDate: new Date('2019-07-23') });
    const later = caseAuth({ id: 'later', title: target.title, decisionDate: new Date('2025-01-01') });
    const other = caseAuth({ id: 'other', title: 'Other Company v Another Employee', decisionDate: new Date('2019-01-01') });
    const act = statute({ id: 'act', title: 'Employment Act' });
    const query = 'Explain Kenfreight (EA) Limited v Nguti [2019] KESC 79 (KLR), including actual outcome.';
    expect(focusNamedCaseEvidence([act, target, other, later], query).map(a => a.id)).toEqual(['act', 'target']);
    expect(focusNamedCaseEvidence([act, other, later], query).map(a => a.id)).toEqual(['act']);
    expect(focusNamedCaseEvidence([act, target, other], query + ' Find similar precedents.')).toHaveLength(3);
  });
  it('detects named statutes and party case titles', () => {
    expect(hasNamedStatuteCheck('Whether regular bail under BNSS 480 should be granted')).toBe(true);
    expect(hasNamedStatuteCheck('What is the limitation period generally')).toBe(false);
    expect(extractNamedCaseTitles('Compare Gudikanti Narasimhulu v Public Prosecutor with the facts')).toEqual(
      expect.arrayContaining([expect.stringMatching(/Gudikanti/i)]),
    );
  });

  it('keeps named statutes and quoteable cases only', () => {
    const pack = filterAuthoritiesToCheckPack(
      [
        statute({ id: 'sf-480', title: 'BNSS §480: Regular bail', citation: 'BNSS §480' }),
        statute({ id: 'dump-cpc', title: 'CPC §151', citation: 'CPC §151' }),
        caseAuth({
          id: 'escr-1',
          title: 'State v Accused',
          sourceUrl: 'https://scr.sci.gov.in/judgment/1',
          fullText: 'The Supreme Court held that regular bail is the rule when investigation is pending. '.repeat(3),
        }),
        caseAuth({
          id: 'orphan',
          title: 'Mystery v Unknown',
          summary: 'Short',
        }),
      ],
      'Whether Rahul should get regular bail under BNSS 480',
    );
    expect(pack.map((a) => a.id)).toEqual(['sf-480', 'escr-1']);
  });

  it('does not treat an official PDF running header as an identified case', () => {
    expect(isQuoteableCaseAuthority(caseAuth({ id: 'header-only',
      title: 'http://JUDIS.NIC.IN SUPREME COURT OF INDIA Page 1 of 9',
      sourceUrl: 'https://api.sci.gov.in/jonew/judis/7483.pdf',
      fullText: 'The court considered notice and resignation under the employment contract. '.repeat(3),
    }))).toBe(false);
  });

  it('requires URL plus quoteable text for a case', () => {
    expect(
      isQuoteableCaseAuthority(
        caseAuth({
          id: 'x',
          title: 'A v B',
          sourceUrl: 'https://sci.gov.in/j/1',
          summary: 'Holding excerpt that is long enough to quote as an official passage. '.repeat(2),
        }),
      ),
    ).toBe(true);
    expect(
      isQuoteableCaseAuthority(caseAuth({ id: 'y', title: 'A v B', sourceUrl: 'https://sci.gov.in/j/1', summary: 'Too short' })),
    ).toBe(false);
  });

  it('strips invented AIR/SCC and sections not in the pack', () => {
    const pack = [
      statute({ id: 'sf-480', title: 'BNSS §480: Regular bail', citation: 'BNSS §480' }),
    ];
    const { text, strippedCount } = stripOutputToCheckPack(
      'Bail is available under BNSS 480. See also (2012) 1 SCC 40 and Section 437 CrPC.',
      pack,
      'regular bail BNSS 480',
    );
    expect(text).toContain('BNSS 480');
    expect(text).not.toContain('(2012) 1 SCC 40');
    expect(text).toContain(AUTHORITY_GAP_MARKER);
    expect(strippedCount).toBeGreaterThan(0);
  });

  it('marks unsupported sections for non-India jurisdictions too', () => {
    const pack = [
      statute({
        id: 'us-1983',
        title: '42 U.S.C. § 1983 — Civil action for deprivation of rights',
        citation: '42 U.S.C. § 1983',
      }),
    ];
    const { text, strippedCount } = stripOutputToCheckPack(
      'A claim lies under 42 U.S.C. § 1983. Compare 18 U.S.C. § 242 and section 6 of the Human Rights Act 1998.',
      pack,
      'civil rights claim under 42 USC 1983',
      'US',
    );
    // The pack-backed provision survives untouched.
    expect(text).toContain('42 U.S.C. § 1983.');
    // The two unsupported provisions are flagged, not silently deleted.
    expect(text).toContain('18 U.S.C. § 242 [AUTHORITY GAP');
    expect(text).toContain('Human Rights Act 1998 [AUTHORITY GAP');
    expect(strippedCount).toBe(2);
  });

  it('keeps the reasoning readable while flagging the unsupported claim', () => {
    const { text } = stripOutputToCheckPack(
      'Relief may be sought under section 4 of the Fair Administrative Action Act.',
      [],
      'judicial review in Kenya',
      'KE',
    );
    expect(text).toContain('Fair Administrative Action Act');
    expect(text).toContain(AUTHORITY_GAP_MARKER);
  });

  it('skips inventing hops on the default path', () => {
    expect(shouldSkipInventingHops({ userRequestedDeep: false, hasNamedStatutePack: false })).toBe(true);
    expect(shouldSkipInventingHops({ userRequestedDeep: true, hasNamedStatutePack: true })).toBe(true);
    expect(shouldSkipInventingHops({ userRequestedDeep: true, hasNamedStatutePack: false, quotedCaseCount: 0 })).toBe(
      false,
    );
  });
});
