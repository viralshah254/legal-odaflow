import { BadRequestException } from '@nestjs/common';
import type { LlmCompletionService } from '@/ai/llm-completion.service';
import { ResearchRequestNormalizerService } from './research-request-normalizer.service';
import {
  ResearchTaskRouterService,
  routeResearchTaskDeterministically,
} from './research-task-router.service';

describe('research request normalization and task routing', () => {
  const normalizer = new ResearchRequestNormalizerService();

  it('normalizes whitespace, jurisdiction aliases, dates, citations, and statutes', () => {
    const result = normalizer.normalize({
      query: '  Find   AIR 1973 SC 1461 and interpret Section 11 of the Arbitration Act  ',
      countryCode: 'india',
      asOfDate: '2026-07-01T10:30:00Z',
      requestedSources: [' statutes ', 'statutes'],
    });

    expect(result.objective).toBe(
      'Find AIR 1973 SC 1461 and interpret Section 11 of the Arbitration Act',
    );
    expect(result.countryCode).toBe('IN');
    expect(result.asOfDate).toBe('2026-07-01');
    expect(result.requestedSources).toEqual(['statutes']);
    expect(result.citedAuthorities).toContain('AIR 1973 SC 1461');
    expect(result.statuteReferences[0]).toMatch(/Section 11/i);
  });

  it('rejects an empty objective and invalid date', () => {
    expect(() => normalizer.normalize({ query: ' ' })).toThrow(BadRequestException);
    expect(() => normalizer.normalize({ query: 'bail', asOfDate: 'not-a-date' })).toThrow(
      BadRequestException,
    );
  });

  it('routes deterministically with auditable scores', () => {
    const request = normalizer.normalize({
      query: 'Find adverse authorities that distinguished this precedent',
      countryCode: 'IN',
    });
    const profile = routeResearchTaskDeterministically(request);

    expect(profile.kind).toBe('ADVERSE_AUTHORITY');
    expect(profile.confidence).toBe('HIGH');
    expect(profile.scores.ADVERSE_AUTHORITY).toBeGreaterThan(
      profile.scores.GENERAL_RESEARCH,
    );
    expect(profile.fallbackUsed).toBe(false);
  });

  it('routes low-confidence requests without waiting for another model completion', async () => {
    const llm = {
      isModelConfigured: jest.fn().mockReturnValue(true),
      complete: jest.fn().mockResolvedValue({
        content: JSON.stringify({ kind: 'CASE_LOOKUP', reason: 'Requests authorities' }),
      }),
    } as unknown as LlmCompletionService;
    const service = new ResearchTaskRouterService(llm);

    const profile = await service.route(
      normalizer.normalize({ query: 'Research remedies available to the client' }),
    );

    expect(profile.kind).toBe('GENERAL_RESEARCH');
    expect(profile.fallbackUsed).toBe(false);
    expect(llm.complete).not.toHaveBeenCalled();
  });

  it('does not call an unconfigured model', async () => {
    const llm = {
      isModelConfigured: jest.fn().mockReturnValue(false),
      complete: jest.fn(),
    } as unknown as LlmCompletionService;
    const profile = await new ResearchTaskRouterService(llm).route(
      normalizer.normalize({ query: 'Research remedies available to the client' }),
    );

    expect(profile.kind).toBe('GENERAL_RESEARCH');
    expect(llm.complete).not.toHaveBeenCalled();
  });
});
