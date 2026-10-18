import { AuthorityTripleCheckService } from './authority-triple-check.service';

describe('AuthorityTripleCheckService', () => {
  const service = new AuthorityTripleCheckService();

  it('extracts case and statute section refs', () => {
    const refs = service.extract(
      'See BNSS section 483 and Kesavananda Bharati v State of Kerala. Also AIR 1973 SC 1461.',
    );
    expect(refs.some((r) => r.kind === 'statute_section')).toBe(true);
    expect(refs.some((r) => /Kesavananda|AIR 1973/i.test(r.raw))).toBe(true);
  });

  it('marks verified only with ≥2 agreeing passes', async () => {
    const markdown = 'Bail under BNSS section 483 before the Sessions Court.';
    const result = await service.check({
      markdown,
      countryCode: 'IN',
      corpusAuthorities: [
        {
          title: 'BNSS s.483',
          citation: 'BNSS s.483',
          summary: 'Special powers of High Court or Court of Session regarding bail',
          sourceName: 'India Code',
          sourceTier: 'primary',
        },
        {
          title: 'BNSS s.483',
          citation: 'BNSS s.483',
          sourceUrl: 'https://indiankanoon.org/doc/123',
          sourceTier: 'case_law',
        },
      ],
    });
    const target = result.authorities.find((a) => /483/.test(a.raw));
    expect(target).toBeDefined();
    expect(target!.agreementCount).toBeGreaterThanOrEqual(2);
    expect(['verified', 'corrected']).toContain(target!.state);
  });

  it('does not verify invented authorities without hits', async () => {
    const result = await service.check({
      markdown: 'See Completely Fake Case v Made Up Respondent (2099) 1 FAKE 1.',
      countryCode: 'UG',
      corpusAuthorities: [],
    });
    expect(result.verifiedCount).toBe(0);
    expect(result.authorities.every((a) => a.state === 'unverified')).toBe(true);
  });

  it('rejects cross-act correction from Contract Act s.23 to Income-tax Schedule VI', async () => {
    const markdown =
      'Section 23 of the Indian Contract Act prohibits unlawful consideration.';
    const result = await service.check({
      markdown,
      countryCode: 'IN',
      query: 'Indian Contract Act waiver section 23 mandatory',
      statuteSections: ['23'],
      corpusAuthorities: [
        {
          title: 'Income-tax Act Schedule VI',
          citation: 'Income-tax Act Schedule VI',
          summary: 'Visual effects',
          sourceTier: 'primary',
        },
      ],
    });
    expect(result.repairedMarkdown).toContain('Section 23 of the Indian Contract Act');
    expect(result.repairedMarkdown).not.toMatch(/schedule-VI/i);
  });
});
