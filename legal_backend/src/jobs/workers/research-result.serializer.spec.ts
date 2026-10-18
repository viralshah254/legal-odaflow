import type { LawyerResearchResult } from '@/ai/ai-gateway.service';
import { serializeResearchJobResult } from './research-result.serializer';

describe('serializeResearchJobResult', () => {
  it('preserves requested and resolved task diagnostics through the worker boundary', () => {
    const serialized = serializeResearchJobResult(
      {
        outputMarkdown: 'Survey',
        taskProfile: {
          kind: 'CASE_SURVEY',
          confidence: 'HIGH',
          scores: { CASE_SURVEY: 10 } as never,
          reasons: [],
          tied: false,
          fallbackUsed: false,
          requiredCapabilities: ['CASE_LAW'],
          sourcePlan: {
            mode: 'AUTO',
            effectiveSources: ['case_law', 'statutes', 'web'],
            discoverySources: ['web'],
            reasons: [],
          },
        },
        creditsUsed: 1,
        requiresLawyerReview: true,
      } as unknown as LawyerResearchResult,
      {
        query: 'similar partnership arbitration cases',
        countryCode: 'IN',
        queueWaitMs: 4,
        requestedTaskKind: 'CASE_SURVEY',
      },
    );

    expect(serialized).toEqual(
      expect.objectContaining({
        requestedTaskKind: 'CASE_SURVEY',
        resolvedTaskKind: 'CASE_SURVEY',
        taskProfile: expect.objectContaining({
          sourcePlan: expect.objectContaining({
            effectiveSources: ['case_law', 'statutes', 'web'],
          }),
        }),
      }),
    );
  });

  it('rejects a stale worker result that resolved to an incompatible task', () => {
    expect(() =>
      serializeResearchJobResult(
        {
          outputMarkdown: 'Comparison',
          taskProfile: { kind: 'CASE_COMPARISON' },
          creditsUsed: 1,
          requiresLawyerReview: true,
        } as unknown as LawyerResearchResult,
        {
          query: 'similar partnership arbitration cases',
          countryCode: 'IN',
          queueWaitMs: 4,
          requestedTaskKind: 'CASE_SURVEY',
        },
      ),
    ).toThrow('Research task drift');
  });
});
