import { ConfigService } from '@nestjs/config';
import type { LegalSourceService } from '@/legal-sources/legal-source.service';
import { ResearchCapabilityService } from './research-capability.service';

describe('ResearchCapabilityService', () => {
  it('builds availability only from verified registry and connector evidence', async () => {
    const legalSources = {
      list: jest.fn().mockResolvedValue([
        { id: 'statutes', sourceType: 'statute', enabled: true },
        { id: 'disabled-cases', sourceType: 'case_law', enabled: false },
      ]),
    } as unknown as LegalSourceService;
    const service = new ResearchCapabilityService(
      new ConfigService({ LEGAL_RESEARCH_LIVE_CONNECTORS_ENABLED: 'true' }),
      legalSources,
      { isConfigured: () => true } as never,
      { isConfigured: () => false } as never,
      undefined,
      undefined,
      { isConfigured: () => true } as never,
    );

    const snapshot = await service.snapshot('IN');

    expect(snapshot.availableCapabilities).toEqual(
      expect.arrayContaining(['CASE_LAW', 'STATUTES', 'CURRENT_LAW', 'LIVE_WEB']),
    );
    expect(snapshot.availableCapabilities).not.toContain('TREATMENT');
    expect(snapshot.sources.find((source) => source.id === 'india-kanoon')?.available).toBe(true);
  });

  it('fails closed when metadata cannot be read and no connector is verified', async () => {
    const legalSources = {
      list: jest.fn().mockRejectedValue(new Error('database unavailable')),
    } as unknown as LegalSourceService;
    const service = new ResearchCapabilityService(new ConfigService(), legalSources);

    const snapshot = await service.snapshot('ZZ');

    expect(snapshot.failClosed).toBe(true);
    expect(snapshot.availableCapabilities).toEqual([]);
    expect(snapshot.unavailableCapabilities).toContain('CASE_LAW');
    expect(snapshot.limitations).toEqual(
      expect.arrayContaining([
        expect.stringContaining('metadata could not be read'),
        expect.stringContaining('CASE_LAW'),
      ]),
    );
  });

  it('honours the global connector configuration switch', async () => {
    const service = new ResearchCapabilityService(
      new ConfigService({ LEGAL_RESEARCH_LIVE_CONNECTORS_ENABLED: 'false' }),
      { list: jest.fn().mockResolvedValue([]) } as unknown as LegalSourceService,
      { isConfigured: () => true } as never,
    );

    const snapshot = await service.snapshot('IN');
    const connector = snapshot.sources.find((source) => source.id === 'india-kanoon');
    expect(connector).toEqual(
      expect.objectContaining({
        available: false,
        reason: 'Live connectors disabled by configuration',
      }),
    );
  });

  it('reports Kenya official statute and full-text judgment capabilities', async () => {
    const service = new ResearchCapabilityService(
      new ConfigService({ LEGAL_RESEARCH_LIVE_CONNECTORS_ENABLED: 'true' }),
      { list: jest.fn().mockResolvedValue([]) } as unknown as LegalSourceService,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      {} as never,
      {} as never,
      { isEnabled: () => true } as never,
    );

    const snapshot = await service.snapshot('KE');

    expect(snapshot.availableCapabilities).toEqual(
      expect.arrayContaining(['CASE_LAW', 'STATUTES', 'CURRENT_LAW']),
    );
    expect(snapshot.officialSourceAccess).toBe(true);
    expect(snapshot.fullTextSupport).toBe(true);
    expect(snapshot.languageSupport).toEqual(['en', 'sw']);
    expect(snapshot.courtCoverage).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ court: 'Supreme Court of Kenya' }),
        expect.objectContaining({ court: 'Court of Appeal of Kenya' }),
      ]),
    );
  });
});
