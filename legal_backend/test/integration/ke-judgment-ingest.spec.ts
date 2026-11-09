import {
  judgmentIdFromFrbrUri,
  KenyaLawJudgmentConnector,
} from '@/legal-sources/connectors/kenya-law-judgment.connector';

describe('KenyaLawJudgmentConnector', () => {
  const connector = new KenyaLawJudgmentConnector();

  it('parses judgments Atom feed entries', () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>Test v Republic [2026] KECA 1 (KLR)</title>
    <link href="https://new.kenyalaw.org/akn/ke/judgment/keca/2026/1/eng@2026-06-26" rel="alternate"/>
    <published>2026-06-26T00:00:00+00:00</published>
    <summary type="html">Test v Republic</summary>
  </entry>
</feed>`;

    const hits = connector.parseJudgmentsFeed(xml);
    expect(hits).toHaveLength(1);
    expect(hits[0].docType).toBe('judgment');
    expect(hits[0].id).toBe('ke-judgment-keca-2026-1');
    expect(hits[0].sourceUrl).toContain('/akn/ke/judgment/keca/2026/1');
  });

  it('builds stable judgment ids from FRBR URIs', () => {
    expect(
      judgmentIdFromFrbrUri('akn/ke/judgment/kehc/2026/9038/eng@2026-06-26'),
    ).toBe('ke-judgment-kehc-2026-9038');
  });
});

// Explicit online canary: RUN_LIVE_CONNECTOR_TESTS=true npm test -- ke-judgment-ingest
const describeLive = process.env.RUN_LIVE_CONNECTOR_TESTS === 'true' ? describe : describe.skip;
describeLive('KenyaLawJudgmentConnector search (live)', () => {
  const connector = new KenyaLawJudgmentConnector();

  it('returns employment judgments from the public search API', async () => {
    const hits = await connector.searchJudgments('unfair dismissal', 3);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((hit) => hit.docType === 'judgment')).toBe(true);
    expect(hits[0].expressionFrbrUri).toMatch(/^akn\/ke\/judgment\//);
  }, 20_000);
});
