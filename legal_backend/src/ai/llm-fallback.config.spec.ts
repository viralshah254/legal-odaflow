import { buildLlmFallbackChain, getLegacyFallbacksForModel } from './llm-fallback.config';

describe('llm-fallback.config', () => {
  it('adds gpt-4o-mini legacy fallback for gpt-5.6-terra', () => {
    expect(getLegacyFallbacksForModel('gpt-5.6-terra')).toEqual(['gpt-4o-mini']);
    expect(buildLlmFallbackChain('gpt-5.6-terra')).toEqual([
      'deepseek-chat',
      'gpt-5.4-mini',
      'gpt-4o-mini',
    ]);
  });

  it('prefers another premium OpenAI model when gpt-5.6-sol is unavailable', () => {
    expect(getLegacyFallbacksForModel('gpt-5.6-sol')[0]).toBe('gpt-5.6-terra');
    expect(buildLlmFallbackChain('gpt-5.6-sol')[0]).toBe('gpt-5.6-terra');
  });

  it('adds gpt-4o-mini for any gpt-5.6-* model without explicit mapping', () => {
    expect(getLegacyFallbacksForModel('gpt-5.6-custom')).toEqual(['gpt-4o-mini']);
  });

  it('falls back to gpt-5.4-mini when deepseek is primary', () => {
    expect(buildLlmFallbackChain('deepseek-chat')).toEqual(['gpt-5.4-mini']);
  });

  it('deduplicates models in the fallback chain', () => {
    const chain = buildLlmFallbackChain('gpt-5.6-luna');
    expect(new Set(chain).size).toBe(chain.length);
  });
});
