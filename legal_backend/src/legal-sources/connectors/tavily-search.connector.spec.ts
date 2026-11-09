import { ConfigService } from '@nestjs/config';
import { TavilySearchConnector } from './tavily-search.connector';

describe('TavilySearchConnector failure controls', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('does not send an explicit unsupported country to India or US source defaults', async () => {
    global.fetch = jest.fn(async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      expect(body.query).toContain('France (FR)');
      expect(body.include_domains).toBeUndefined();
      return new Response(JSON.stringify({ results: [] }), { status: 200 });
    }) as typeof fetch;
    const connector = new TavilySearchConnector(new ConfigService({ TAVILY_API_KEY: 'test-key' }));
    await connector.search({ query: 'employee notice', countryCode: 'FR' });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('keeps federal country scopes on their own primary-source domains', async () => {
    global.fetch = jest.fn(async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      expect(body.include_domains).toContain('supremecourt.gov');
      expect(body.include_domains).not.toContain('indiankanoon.org');
      return new Response(JSON.stringify({ results: [] }), { status: 200 });
    }) as typeof fetch;
    const connector = new TavilySearchConnector(new ConfigService({ TAVILY_API_KEY: 'test-key' }));
    await connector.search({ query: 'employee notice', countryCode: 'US-FEDERAL' });
  });

  it('opens a circuit after repeated HTTP 400s and skips subsequent calls', async () => {
    global.fetch = jest.fn(async () => new Response('', { status: 400 })) as typeof fetch;
    const connector = new TavilySearchConnector(
      new ConfigService({
        TAVILY_API_KEY: 'test-key',
        TAVILY_FAILURE_COOLDOWN_MS: '60000',
      }),
    );

    await connector.search({ query: 'employee surveillance dismissal India' });
    expect(connector.isCircuitOpen()).toBe(false);
    await connector.search({ query: 'workplace AI monitoring India' });
    expect(connector.isCircuitOpen()).toBe(true);
    await connector.search({ query: 'third query after circuit' });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
