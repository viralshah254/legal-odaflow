import { ConfigService } from '@nestjs/config';
import { TavilySearchConnector } from './tavily-search.connector';

describe('TavilySearchConnector failure controls', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
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
