import { SectionFinderAiFallbackService } from './section-finder-ai-fallback.service';
import type { ConfigService } from '@nestjs/config';
import type { LlmCompletionService } from '@/ai/llm-completion.service';

describe('SectionFinderAiFallbackService', () => {
  it('returns AI-suggested (not verified) structured suggestions from a lower model', async () => {
    const config = {
      get: (key: string) =>
        key === 'AI_LEGAL_FAST_MODEL' ? 'gpt-5.6-luna' : undefined,
    } as unknown as ConfigService;
    const llm = {
      complete: jest.fn().mockResolvedValue({
        content: JSON.stringify({
          suggestions: [
            {
              actId: 'bnss',
              actShort: 'BNSS',
              section: '483',
              title: 'Special powers of High Court or Court of Session regarding bail',
              confidence: 'medium',
              rationale: 'Common Sessions/HC bail provision',
            },
          ],
        }),
      }),
    } as unknown as LlmCompletionService;

    const service = new SectionFinderAiFallbackService(config, llm);
    const result = await service.suggest({
      query: 'sessions court bail special powers',
      countryCode: 'IN',
    });

    expect(result.modelName).toContain('luna');
    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0].source).toBe('ai_suggest');
    expect(result.suggestions[0].verificationState).toBe('ai_suggested');
    expect(llm.complete).toHaveBeenCalledWith(
      expect.objectContaining({ modelName: 'gpt-5.6-luna' }),
    );
  });

  it('proposeCandidatesFromIntent returns the same unverified suggestion shape', async () => {
    const config = {
      get: (key: string) =>
        key === 'AI_LEGAL_FAST_MODEL' ? 'gpt-5.6-luna' : undefined,
    } as unknown as ConfigService;
    const llm = {
      complete: jest.fn().mockResolvedValue({
        content: JSON.stringify({
          suggestions: [
            {
              actId: 'bnss',
              actShort: 'BNSS',
              section: '480',
              title: 'When bail may be taken in case of non-bailable offence',
              confidence: 'high',
              rationale: 'Bail fact pattern',
            },
          ],
        }),
      }),
    } as unknown as LlmCompletionService;

    const service = new SectionFinderAiFallbackService(config, llm);
    const result = await service.proposeCandidatesFromIntent({
      query: 'client wants regular bail after FIR for theft',
      countryCode: 'IN',
    });

    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0]).toMatchObject({
      section: '480',
      source: 'ai_suggest',
      verificationState: 'ai_suggested',
    });
  });
});
