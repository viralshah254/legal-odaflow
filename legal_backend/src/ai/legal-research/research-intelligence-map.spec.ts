import { ResearchIntelligenceMapService } from './research-intelligence-map.service';
import { ConfigService } from '@nestjs/config';

describe('ResearchIntelligenceMapService', () => {
  const service = new ResearchIntelligenceMapService(
    { complete: jest.fn() } as never,
    { get: () => 'gpt-5.6-sol' } as unknown as ConfigService,
  );

  it('fallback map for India CIBIL/loan facts includes RBI/CPA/IT queries', () => {
    const map = service.fallbackMap(
      {
        query:
          'Riya Mehta fraudulent loan CIBIL damage Ahmedabad digital lender recovery agents',
        countryCode: 'IN',
      },
      'gpt-5.6-sol',
      'test',
    );
    expect(map.degraded).toBe(true);
    expect(map.researchQueries.length).toBeGreaterThan(3);
    const blob = map.researchQueries.map((q) => q.query).join(' ');
    expect(blob).toMatch(/rbi/i);
    expect(blob).toMatch(/consumer protection|cpa/i);
    expect(blob).toMatch(/it act|identity/i);
  });

  it('fallback map for India tenant premature-notice facts prefers TPA over Constitution', () => {
    const map = service.fallbackMap(
      {
        query:
          'What remedies are available to a tenant in India when a landlord issues a notice to vacate before the contractual notice period expires?',
        countryCode: 'IN',
      },
      'gpt-5.6-sol',
      'test',
    );
    const statuteBlob = map.likelyStatutes.map((s) => s.title).join(' ');
    expect(statuteBlob).toMatch(/Transfer of Property/i);
    expect(statuteBlob).toMatch(/Specific Relief/i);
    expect(statuteBlob).not.toMatch(/Constitution/i);
    expect(map.researchQueries.some((q) => /section 106/i.test(q.query))).toBe(true);
  });

  it('expandRetrievalQueries returns unique targeted queries', () => {
    const map = service.fallbackMap(
      { query: 'fraudulent loan India', countryCode: 'IN' },
      'test',
      'x',
    );
    const expanded = service.expandRetrievalQueries(map, 8);
    expect(expanded.length).toBeGreaterThan(0);
    expect(new Set(expanded).size).toBe(expanded.length);
  });
});
