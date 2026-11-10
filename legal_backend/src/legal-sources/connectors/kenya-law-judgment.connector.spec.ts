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

describe('Kenya Law full-document evidence', () => {
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; });

  it('preserves nested numbered paragraphs and authentic source metadata', async () => {
    global.fetch = jest.fn().mockResolvedValue(new Response(`<title>Employer v Employee [2025] KEELRC 12 (KLR) - Kenya Law</title>
      <div id="document-content"><div><p id="para_17">We hold that the employment notice requirement applies to the contract before this court.</p></div>
      <div><p id="para_18">For those reasons the appeal is dismissed and each party shall bear its own costs.</p></div></div>`));
    const result = await new KenyaLawJudgmentConnector().fetchJudgmentBody('https://new.kenyalaw.org/akn/ke/judgment/keelrc/2025/12/');
    expect(result?.citation).toBe('[2025] KEELRC 12 (KLR)');
    expect(result?.sourcePassages?.map(p => p.paragraph)).toEqual(['17', '18']);
    expect(result?.sourceProvenance).toMatchObject({ authoritativeStatus: 'OFFICIAL', paragraphNumberingIntegrity: 'INTACT', dispositionComplete: true });
    expect(result?.sourceProvenance?.documentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects shells and untrusted hosts instead of treating them as judgments', async () => {
    global.fetch = jest.fn().mockResolvedValue(new Response('<div id="document-content">Loading...</div>'));
    const connector = new KenyaLawJudgmentConnector();
    expect(await connector.fetchJudgmentBody('https://new.kenyalaw.org/akn/ke/judgment/kesc/2025/1/')).toBeNull();
    expect(await connector.fetchJudgmentBody('https://kenyalaw.org.attacker.example/')).toBeNull();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});

describe('Kenya legislation evidence', () => {
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; });
  it('retains nested provision text and real section identifiers as excerpts', async () => {
    global.fetch = jest.fn().mockResolvedValue(new Response(`<title>Employment Act - Kenya Law</title><section id="sec_35" class="akn-section"><h3>35. Notice</h3><p class="akn-p">A contract <b>shall</b> be terminable by notice subject to the applicable terms.</p></section>`));
    const result = await new KenyaLawJudgmentConnector().fetchLegislationBody('https://new.kenyalaw.org/akn/ke/act/2007/11/eng@2022-12-31');
    expect(result?.fullText).toContain('A contract shall be terminable');
    expect(result?.sourcePassages?.[0]).toMatchObject({ paragraph: 'Section 35', sourcePinpoint: true });
    expect(result?.sourceProvenance?.completeness).toBe('EXCERPT');
  });
  it('does not admit a WAF challenge as a successful document', async () => {
    global.fetch = jest.fn().mockResolvedValue(new Response('', { status: 202 }));
    expect(await new KenyaLawJudgmentConnector().fetchJudgmentBody('https://new.kenyalaw.org/akn/ke/judgment/kesc/2019/79/')).toBeNull();
  });
});

describe('Kenya Law challenge circuit', () => {
  it('stops repeated search and body requests after an empty access challenge', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue(new Response('', { status: 202 }));
    try {
      const connector = new KenyaLawJudgmentConnector();
      expect(await connector.searchJudgments('public case')).toEqual([]);
      expect(connector.isCircuitOpen()).toBe(true);
      expect(await connector.searchJudgments('another public case')).toEqual([]);
      expect(await connector.fetchJudgmentBody('https://new.kenyalaw.org/akn/ke/judgment/kesc/2019/79/')).toBeNull();
      expect(global.fetch).toHaveBeenCalledTimes(1);
    } finally { global.fetch = originalFetch; }
  });
});
