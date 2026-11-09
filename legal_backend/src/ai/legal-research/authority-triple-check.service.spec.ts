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

describe('Authority checking concurrency', () => {
  afterEach(() => jest.useRealTimers());

  it('overlaps independent connector calls with a maximum of four and preserves reference order', async () => {
    jest.useFakeTimers();
    const checker = new AuthorityTripleCheckService();
    const refs = Array.from({ length: 10 }, (_, i) => ({ raw: `BNSS section ${i + 1}`, kind: 'statute_section' as const }));
    jest.spyOn(checker, 'extract').mockReturnValue(refs);
    jest.spyOn(checker as any, 'matchCorpus').mockReturnValue({ pass: 'corpus', hit: true });
    let active = 0;
    let peak = 0;
    jest.spyOn(checker as any, 'matchConnector').mockImplementation(async () => {
      peak = Math.max(peak, ++active);
      await new Promise((resolve) => setTimeout(resolve, 10));
      active--;
      return { pass: 'connector', hit: true };
    });
    const web = jest.spyOn(checker as any, 'matchWeb');
    const pending = checker.check({ markdown: '', countryCode: 'IN', corpusAuthorities: [] });
    await jest.advanceTimersByTimeAsync(30);
    const result = await pending;
    expect(peak).toBe(4);
    expect(result.authorities.map((a) => a.raw)).toEqual(refs.map((r) => r.raw));
    expect(result.verifiedCount).toBe(10);
    expect(web).not.toHaveBeenCalled();
  });

  it('allocates at most six web searches in extraction order despite concurrent connector completion', async () => {
    const checker = new AuthorityTripleCheckService();
    const refs = Array.from({ length: 10 }, (_, i) => ({ raw: `BNSS section ${i + 1}`, kind: 'statute_section' as const }));
    jest.spyOn(checker, 'extract').mockReturnValue(refs);
    jest.spyOn(checker as any, 'matchCorpus').mockReturnValue({ pass: 'corpus', hit: false });
    jest.spyOn(checker as any, 'matchConnector').mockResolvedValue({ pass: 'connector', hit: false });
    const web = jest.spyOn(checker as any, 'matchWeb').mockResolvedValue({ pass: 'web', hit: false });
    const result = await checker.check({ markdown: '', countryCode: 'IN', corpusAuthorities: [] });
    expect(web.mock.calls.map((args) => (args[0] as { raw: string }).raw)).toEqual(refs.slice(0, 6).map((r) => r.raw));
    expect(result.unverifiedCount).toBe(10);
    expect(result.verifiedCount).toBe(0);
  });
});
