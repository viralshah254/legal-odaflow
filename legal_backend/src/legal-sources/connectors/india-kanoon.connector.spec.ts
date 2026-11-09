import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import {
  IndiaKanoonConnector,
  extractIndiaKanoonPassages,
} from './india-kanoon.connector';

describe('IndiaKanoonConnector passage parsing', () => {
  it('preserves source paragraph identifiers from judgment markup', () => {
    const passages = extractIndiaKanoonPassages(`
      <div id="para_17">17. The court held that the statutory safeguard is mandatory.</div>
      <p data-paragraph="18">The consequence of non-compliance is invalidity.</p>
    `);

    expect(passages).toEqual([
      expect.objectContaining({ paragraph: '17', sourcePinpoint: true }),
      expect.objectContaining({ paragraph: '18', sourcePinpoint: true }),
    ]);
  });

  it('preserves paragraph anchors inside nested judgment containers', () => {
    const passages = extractIndiaKanoonPassages('<div class="judgments"><div class="body"><p id="para_17">We therefore hold that the employment notice clause governs resignation.</p><p id="para_18">The appeal is dismissed for the reasons stated above.</p></div></div>');
    expect(passages.map((passage) => passage.paragraph)).toEqual(['17', '18']);
    expect(passages.every((passage) => passage.sourcePinpoint)).toBe(true);
  });

  it('does not invent a pinpoint for unnumbered source blocks', () => {
    const passages = extractIndiaKanoonPassages(
      '<p>The judgment discusses the governing rule in enough detail to be useful evidence.</p>',
    );

    expect(passages).toEqual([
      expect.objectContaining({
        paragraph: undefined,
        sourcePinpoint: false,
      }),
    ]);
  });
});

describe('IndiaKanoonConnector failure controls', () => {
  it('never creates full-document provenance from a search snippet', async () => {
    global.fetch = jest.fn(async () => new Response(JSON.stringify({ docs: [{ tid: 123,
      title: 'Employer v Employee', headline: 'The appeal is dismissed. Employment notice applies.' }], found: 1 }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    })) as typeof fetch;
    const connector = new IndiaKanoonConnector(new ConfigService({ INDIA_KANOON_API_KEY: 'test-key' }));
    const [result] = await connector.search({ query: 'employee notice', skipEnrich: true });
    expect(result.sourceProvenance).toBeUndefined();
    expect(result.fullText).toBeUndefined();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('retains the fetched document provenance and source paragraph anchors through enrichment', async () => {
    global.fetch = jest.fn(async (url) => new Response(JSON.stringify(String(url).includes('/search/')
      ? { docs: [{ tid: 123, title: 'Employer v Employee' }], found: 1 }
      : { doc: '<p id="para_12">We therefore hold that resignation is governed by the employment terms.</p><p id="para_13">The appeal is dismissed.</p>' }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    })) as typeof fetch;
    const connector = new IndiaKanoonConnector(new ConfigService({ INDIA_KANOON_API_KEY: 'test-key' }));
    const [result] = await connector.search({ query: 'employee resignation', fetchFullText: true });
    expect(result.sourceProvenance).toMatchObject({ provider: 'Indian Kanoon API', completeness: 'COMPLETE', authoritativeStatus: 'AGGREGATOR', paragraphNumberingIntegrity: 'INTACT', dispositionComplete: true });
    expect(result.sourceProvenance?.documentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.passages?.[0].paragraph).toBe('12');
  });

  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('opens a short circuit after a provider authorization failure', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    global.fetch = jest.fn(async () => new Response('', { status: 403 })) as typeof fetch;
    const connector = new IndiaKanoonConnector(
      new ConfigService({
        INDIA_KANOON_API_KEY: 'test-key',
        INDIA_KANOON_FAILURE_COOLDOWN_MS: '60000',
        INDIA_KANOON_AUTH_FAILURE_COOLDOWN_MS: '60000',
      }),
    );

    await connector.search({ query: 'PRIVATE_CLIENT_MATTER_QUERY' });
    expect(JSON.stringify(warn.mock.calls)).not.toContain('PRIVATE_CLIENT_MATTER_QUERY');
    expect(connector.isCircuitOpen()).toBe(true);
    const second = await connector.searchWithOutcome({
      query: 'arbitration adverse authority',
    });
    expect(second.status).toBe('circuit_open');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('returns structured outcome when API key is missing', async () => {
    const connector = new IndiaKanoonConnector(new ConfigService({}));
    const outcome = await connector.searchWithOutcome({ query: 'partnership arbitration' });
    expect(outcome).toMatchObject({
      status: 'not_configured',
      results: [],
      hitCount: 0,
    });
  });

  it('returns no_hits outcome for empty provider response', async () => {
    global.fetch = jest.fn(async () =>
      new Response(JSON.stringify({ docs: [], found: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ) as typeof fetch;
    const connector = new IndiaKanoonConnector(
      new ConfigService({ INDIA_KANOON_API_KEY: 'test-key' }),
    );

    await connector.search({ query: 'same query' });
    await connector.search({ query: 'same query' });

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
