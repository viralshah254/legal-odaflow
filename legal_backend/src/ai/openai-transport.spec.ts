import {
  getOpenAiApiMode,
  isDeepSeekConfigured,
  isOpenAiConfigured,
  isWhisperConfigured,
  resolveAzureDeployment,
  resolveOpenAiUrl,
  resolveWhisperUrl,
} from './openai-transport';

function mockConfig(values: Record<string, string>) {
  return {
    get: <T = string>(key: string, defaultValue?: T) =>
      (values[key] as T | undefined) ?? defaultValue,
  };
}

describe('openai-transport', () => {
  const azure = mockConfig({
    OPENAI_API_MODE: 'azure',
    AZURE_OPENAI_ENDPOINT: 'https://umbrellaopenai.openai.azure.com',
    AZURE_OPENAI_API_KEY: 'test-key',
    AZURE_OPENAI_API_VERSION: '2024-10-21',
  });

  it('routes only OpenAI-family through Azure', () => {
    expect(getOpenAiApiMode(azure)).toBe('azure');
    expect(isOpenAiConfigured(azure)).toBe(true);
    expect(isDeepSeekConfigured(azure)).toBe(false);
  });

  it('builds Azure OpenAI deployment URLs for GPT', () => {
    expect(resolveOpenAiUrl(azure, 'chat/completions', 'gpt-5.4-mini')).toBe(
      'https://umbrellaopenai.openai.azure.com/openai/deployments/gpt-5.4-mini/chat/completions?api-version=2024-10-21',
    );
  });

  it('maps deployment names from AZURE_OPENAI_DEPLOYMENT_MAP', () => {
    const mapped = mockConfig({
      OPENAI_API_MODE: 'azure',
      AZURE_OPENAI_ENDPOINT: 'https://umbrellaopenai.openai.azure.com',
      AZURE_OPENAI_API_KEY: 'test-key',
      AZURE_OPENAI_DEPLOYMENT_MAP: JSON.stringify({
        'gpt-5.4-mini': 'gpt-54-mini',
        'text-embedding-3-small': 'embed-small',
      }),
    });
    expect(resolveAzureDeployment(mapped, 'gpt-5.4-mini')).toBe('gpt-54-mini');
    expect(resolveAzureDeployment(mapped, 'text-embedding-3-small')).toBe(
      'embed-small',
    );
  });

  it('uses DeepSeek native key regardless of OPENAI_API_MODE', () => {
    const withNative = mockConfig({
      OPENAI_API_MODE: 'azure',
      AZURE_OPENAI_ENDPOINT: 'https://umbrellaopenai.openai.azure.com',
      AZURE_OPENAI_API_KEY: 'azure-key',
      DEEPSEEK_API_KEY: 'sk-deepseek-test',
    });
    expect(isDeepSeekConfigured(withNative)).toBe(true);
  });

  it('uses direct OpenAI when mode is direct', () => {
    const direct = mockConfig({
      OPENAI_API_MODE: 'direct',
      OPENAI_API_KEY: 'sk-test',
    });
    expect(resolveOpenAiUrl(direct, 'chat/completions', 'gpt-5.4-mini')).toBe(
      'https://api.openai.com/v1/chat/completions',
    );
    expect(isOpenAiConfigured(direct)).toBe(true);
  });

  it('always routes Whisper to api.openai.com even in azure mode', () => {
    expect(resolveWhisperUrl()).toBe(
      'https://api.openai.com/v1/audio/transcriptions',
    );
    expect(
      resolveOpenAiUrl(azure, 'audio/transcriptions', 'whisper-1'),
    ).toBe('https://api.openai.com/v1/audio/transcriptions');
    expect(isWhisperConfigured(azure)).toBe(false);
    const withOpenAiKey = mockConfig({
      OPENAI_API_MODE: 'azure',
      AZURE_OPENAI_ENDPOINT: 'https://umbrellaopenai.openai.azure.com',
      AZURE_OPENAI_API_KEY: 'azure-key',
      OPENAI_API_KEY: 'sk-openai',
    });
    expect(isWhisperConfigured(withOpenAiKey)).toBe(true);
  });
});
