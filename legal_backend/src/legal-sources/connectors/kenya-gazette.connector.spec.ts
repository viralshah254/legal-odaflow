import { parseKenyaGazetteArchivePage } from './kenya-gazette.connector';

describe('parseKenyaGazetteArchivePage', () => {
  it('extracts official Gazette links and ignores unrelated links', () => {
    const entries = parseKenyaGazetteArchivePage(
      `
        <a href="/akn/ke/officialGazette/2026-07-10/123/eng@2026-07-10">
          Kenya Gazette No. 123, 10 July 2026
        </a>
        <a href="/judgments/">Judgments</a>
      `,
      'https://new.kenyalaw.org/gazettes/',
    );

    expect(entries).toHaveLength(1);
    expect(entries[0].gazetteNumber).toBe('123');
    expect(entries[0].gazetteDate?.toISOString()).toBe('2026-07-10T00:00:00.000Z');
    expect(entries[0].sourceUrl).toContain('/officialGazette/');
  });
});
