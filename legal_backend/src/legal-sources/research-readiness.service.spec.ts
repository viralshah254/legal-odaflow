import { ConfigService } from '@nestjs/config';
import { ResearchReadinessService } from './research-readiness.service';

describe('ResearchReadinessService', () => {
  it('reports degraded when no live connector and empty corpus rows', async () => {
    const service = new ResearchReadinessService(
      new ConfigService({}),
      {
        legalAuthority: {
          count: jest.fn().mockResolvedValue(0),
        },
      } as never,
      { isConfigured: () => false } as never,
      { isConfigured: () => false } as never,
      { isConfigured: () => false } as never,
    );

    const snapshot = await service.snapshot('IN');

    expect(snapshot.caseLawSources.every((source) => !source.available)).toBe(true);
    expect(snapshot.corpus.caseLawRowCount).toBe(0);
    expect(snapshot.limitations.length).toBeGreaterThan(0);
  });
});
