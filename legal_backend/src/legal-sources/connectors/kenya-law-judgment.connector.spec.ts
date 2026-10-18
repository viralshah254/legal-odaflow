jest.mock('./kenya-law-rate-limit', () => ({
  kenyaLawRateLimit: jest.fn().mockResolvedValue(undefined),
  kenyaLawThrottleBackoff: jest.fn().mockResolvedValue(undefined),
  isKenyaLawRetryableStatus: (status: number) =>
    status === 429 || status === 503 || status >= 500,
  kenyaLawFetchHeaders: (accept = 'text/html') => ({
    Accept: accept,
    'User-Agent': 'UmbrellaLegal/1.0-test',
  }),
}));

import { KenyaLawJudgmentConnector } from './kenya-law-judgment.connector';

describe('KenyaLawJudgmentConnector parsers', () => {
  const connector = new KenyaLawJudgmentConnector();

  it('parses Peachjam-embedded search JSON results', () => {
    const html = `
      <html><body>
      <script type="application/json">
      {"results":[{"id":"1","doc_type":"judgment","title":"Ogao v Safaricom","citation":"[2020] KEHC 1","expression_frbr_uri":"/akn/ke/judgment/kehc/2020/1/eng@2020-01-01","work_frbr_uri":"/akn/ke/judgment/kehc/2020/1","court":"High Court","highlight":{"pages.body":["<em>digital</em> lending CRB"]}}]}
      </script>
      </body></html>
    `;
    const hits = connector.parseEmbeddedSearchJson(html, 'judgment', 5);
    expect(hits).toHaveLength(1);
    expect(hits[0].title).toMatch(/Ogao/i);
    expect(hits[0].docType).toBe('judgment');
    expect(hits[0].summary).toMatch(/digital/i);
    expect(hits[0].sourceUrl).toMatch(/kenyalaw\.org/);
  });

  it('parses FRBR judgment links from HTML when embedded JSON is absent', () => {
    const html = `
      <a href="/akn/ke/judgment/kehc/2021/99/eng@2021-06-01">Wanjiku v Credit Reference Bureau</a>
      <a href="/akn/ke/act/2019/24/eng@2019-11-08">Data Protection Act</a>
    `;
    const judgments = connector.parseSearchHtmlLinks(html, 'judgment', 5);
    expect(judgments).toHaveLength(1);
    expect(judgments[0].title).toMatch(/Wanjiku/i);
    expect(judgments[0].docType).toBe('judgment');

    const acts = connector.parseSearchHtmlLinks(html, 'legislation', 5);
    expect(acts).toHaveLength(1);
    expect(acts[0].docType).toBe('legislation');
  });

  it('retries JSON search on 429 then falls back to HTML when API stays empty', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: { get: () => null },
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ results: [] }),
        headers: { get: () => null },
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          `<a href="/akn/ke/judgment/kesc/2019/1/eng@2019-01-01">Sample v Kenya</a>`,
        headers: { get: () => null },
      });
    const originalFetch = global.fetch;
    global.fetch = fetchMock as unknown as typeof fetch;

    try {
      const hits = await connector.search({
        query: 'digital loan CRB',
        docType: 'judgment',
        limit: 3,
      });
      expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
      expect(hits.some((h) => /Sample/i.test(h.title))).toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
