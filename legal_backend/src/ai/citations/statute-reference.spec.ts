import {
  extractStatuteReferences,
  normalizeActName,
  parseStatuteToken,
  statuteReferencesMatch,
} from './statute-reference';

describe('statute-reference', () => {
  it('extracts India references in every common written form', () => {
    const refs = extractStatuteReferences(
      'Bail under Section 480 of the BNSS, read with BNSS 483 and section 437 CrPC.',
      'IN',
    );
    const keys = refs.map((r) => `${r.section}:${r.act}`);
    expect(keys).toEqual(expect.arrayContaining(['480:bnss', '483:bnss', '437:crpc']));
  });

  it('extracts US, GB and Kenya references without any India-specific patterns', () => {
    const us = extractStatuteReferences('A claim under 42 U.S.C. § 1983 is available.', 'US');
    expect(us[0]).toMatchObject({ section: '1983', act: '42 usc' });

    const gb = extractStatuteReferences(
      'See section 6 of the Human Rights Act 1998 and s 1 of the Theft Act 1968.',
      'GB',
    );
    expect(gb.map((r) => `${r.section}:${r.act}`)).toEqual(
      expect.arrayContaining(['6:human rights act', '1:theft act']),
    );

    const ke = extractStatuteReferences(
      'Article 47 of the Constitution and section 4 of the Fair Administrative Action Act apply.',
      'KE',
    );
    expect(ke.map((r) => `${r.section}:${r.act}`)).toEqual(
      expect.arrayContaining(['47:constitution', '4:fair administrative action act']),
    );
  });

  it('treats a bare article as a constitutional reference', () => {
    const refs = extractStatuteReferences('The Article 21 guarantee applies.', 'IN');
    expect(refs[0]).toMatchObject({ section: '21', act: 'constitution' });
  });

  it('does not produce overlapping spans for one reference', () => {
    const refs = extractStatuteReferences('Section 480 of the BNSS applies.', 'IN');
    expect(refs).toHaveLength(1);
  });

  it('normalises act aliases and drops trailing years', () => {
    expect(normalizeActName('Bharatiya Nagarik Suraksha Sanhita, 2023', 'IN')).toBe('bnss');
    expect(normalizeActName('the Theft Act 1968', 'GB')).toBe('theft act');
    expect(normalizeActName('Constitution', 'KE')).toBe('constitution');
  });

  it('matches references tolerantly across naming drift but not across provisions', () => {
    const a = parseStatuteToken('480 BNSS', 'IN');
    const b = extractStatuteReferences('Section 480 of the Bharatiya Nagarik Suraksha Sanhita, 2023', 'IN')[0];
    expect(a && b && statuteReferencesMatch(a, b)).toBe(true);

    const other = extractStatuteReferences('Section 483 BNSS', 'IN')[0];
    expect(a && statuteReferencesMatch(a, other)).toBe(false);
  });

  it('keeps different US code titles distinct', () => {
    const a = extractStatuteReferences('18 U.S.C. § 1983', 'US')[0];
    const b = extractStatuteReferences('42 U.S.C. § 1983', 'US')[0];
    expect(statuteReferencesMatch(a, b)).toBe(false);
  });

  it('parses compact tokens emitted by the named-statute extractor', () => {
    expect(parseStatuteToken('480 BNSS', 'IN')).toMatchObject({ section: '480', act: 'bnss' });
    expect(parseStatuteToken('Article 21', 'IN')).toMatchObject({ section: '21', act: 'constitution' });
  });
});
