import { ConfigService } from '@nestjs/config';
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
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('opens a short circuit after a provider authorization failure', async () => {
    global.fetch = jest.fn(async () => new Response('', { status: 403 })) as typeof fetch;
    const connector = new IndiaKanoonConnector(
      new ConfigService({
        INDIA_KANOON_API_KEY: 'test-key',
        INDIA_KANOON_FAILURE_COOLDOWN_MS: '60000',
        INDIA_KANOON_AUTH_FAILURE_COOLDOWN_MS: '60000',
      }),
    );

    await connector.search({ query: 'arbitration limitation' });
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
