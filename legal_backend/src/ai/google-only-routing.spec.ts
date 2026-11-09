import { LlmCompletionService } from './llm-completion.service';
import { GeminiCompletionAdapter } from './gemini-completion.adapter';

describe('Google-only routing', () => {
  const config = { get: (key: string, fallback?: string) => ({
    AI_PROVIDER: 'google', GOOGLE_AI_API_KEY: 'test', GEMINI_MODEL: 'gemini-2.5-flash',
    GEMINI_REASONING_MODEL: 'gemini-2.5-pro', NODE_ENV: 'production',
  } as Record<string, string>)[key] ?? fallback };
  afterEach(() => jest.restoreAllMocks());

  it('routes premium legacy model requests to Google and preserves system blocks', async () => {
    const complete = jest.spyOn(GeminiCompletionAdapter.prototype, 'complete').mockResolvedValue({
      content: 'answer', inputTokens: 5, outputTokens: 10, provider: 'google',
      modelName: 'gemini-2.5-pro', finishReason: 'stop',
    });
    const service = new LlmCompletionService(config as any);
    await service.complete({ modelName: 'gpt-5.6-sol', minTier: 'premium',
      systemBlocks: [{ text: 'Represent the respondent.' }],
      messages: [{ role: 'user', content: 'Draft a response.' }],
    });
    expect(service.getAllowedProviders()).toEqual(['google']);
    expect(complete).toHaveBeenCalledWith(expect.objectContaining({
      modelName: 'gemini-2.5-pro',
      messages: expect.arrayContaining([{ role: 'system', content: 'Represent the respondent.' }]),
    }));
  });

  it('does not allow another provider when Google-only policy is selected', () => {
    const service = new LlmCompletionService(config as any);
    expect(() => service.assertProviderAllowed('openai')).toThrow('disabled');
    expect(service.isModelConfigured('gpt-5.6-sol')).toBe(true);
  });
});
