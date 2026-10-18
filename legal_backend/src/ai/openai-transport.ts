import { ConfigService } from '@nestjs/config';

export type OpenAiApiMode = 'direct' | 'azure';

export type OpenAiUrlKind =
  | 'chat/completions'
  | 'responses'
  | 'embeddings'
  | 'audio/transcriptions';

type ConfigLike = Pick<ConfigService, 'get'>;

/**
 * Resolve OPENAI_API_MODE. Defaults to `direct` (api.openai.com).
 * When `azure`, GPT chat/responses and embeddings use Azure OpenAI via
 * AZURE_OPENAI_*. Whisper always uses api.openai.com + OPENAI_API_KEY.
 * DeepSeek always uses its native API.
 */
export function getOpenAiApiMode(config: ConfigLike): OpenAiApiMode {
  const raw = (config.get<string>('OPENAI_API_MODE', 'direct') ?? 'direct')
    .trim()
    .toLowerCase();
  return raw === 'azure' ? 'azure' : 'direct';
}

/** True when Azure OpenAI endpoint + key are present. */
export function isAzureOpenAiConfigured(config: ConfigLike): boolean {
  const key = (config.get<string>('AZURE_OPENAI_API_KEY', '') ?? '').trim();
  const endpoint = (config.get<string>('AZURE_OPENAI_ENDPOINT', '') ?? '').trim();
  return Boolean(key && endpoint);
}

/** True when the active OpenAI mode has the credentials it needs. */
export function isOpenAiConfigured(config: ConfigLike): boolean {
  if (getOpenAiApiMode(config) === 'azure') {
    return isAzureOpenAiConfigured(config);
  }
  return Boolean((config.get<string>('OPENAI_API_KEY', '') ?? '').trim());
}

export function openAiNotConfiguredMessage(config: ConfigLike): string {
  if (getOpenAiApiMode(config) === 'azure') {
    return 'Azure OpenAI is not configured. Set AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY (OPENAI_API_MODE=azure).';
  }
  return 'OpenAI is not configured. Set OPENAI_API_KEY for GPT models.';
}

/** DeepSeek always uses DeepSeek's API (never Azure). */
export function isDeepSeekConfigured(config: ConfigLike): boolean {
  return Boolean((config.get<string>('DEEPSEEK_API_KEY', '') ?? '').trim());
}

export function deepSeekNotConfiguredMessage(_config?: ConfigLike): string {
  return 'DeepSeek is not configured. Set DEEPSEEK_API_KEY.';
}

/**
 * Map a logical model id to an Azure deployment name.
 * Uses AZURE_OPENAI_DEPLOYMENT_MAP JSON when present; otherwise the model id.
 */
export function resolveAzureDeployment(
  config: ConfigLike,
  modelName: string,
): string {
  const { map } = parseAzureDeploymentMap(config);
  return map[modelName] ?? modelName;
}

export interface AzureDeploymentMap {
  /** Logical model id → Azure deployment name. Empty when unset or invalid. */
  map: Record<string, string>;
  /** True when AZURE_OPENAI_DEPLOYMENT_MAP is set at all. */
  present: boolean;
  /**
   * Set when the variable is present but unparseable. Every model then falls
   * back to using its own id as the deployment name, which on Azure usually
   * 404s — so this must be visible on the health endpoint rather than silent.
   */
  parseError?: string;
}

export function parseAzureDeploymentMap(config: ConfigLike): AzureDeploymentMap {
  const raw = (config.get<string>('AZURE_OPENAI_DEPLOYMENT_MAP', '') ?? '').trim();
  if (!raw) return { map: {}, present: false };
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const map: Record<string, string> = {};
    for (const [modelId, deployment] of Object.entries(parsed)) {
      if (typeof deployment === 'string' && deployment.trim()) {
        map[modelId] = deployment.trim();
      }
    }
    return { map, present: true };
  } catch (err) {
    return {
      map: {},
      present: true,
      parseError: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Auth headers for OpenAI-family calls (chat / responses / embeddings).
 * Direct: Authorization Bearer. Azure: api-key.
 * Whisper uses {@link resolveWhisperAuthHeaders} instead.
 */
export function resolveOpenAiAuthHeaders(
  config: ConfigLike,
): Record<string, string> {
  if (getOpenAiApiMode(config) === 'azure') {
    const apiKey = (config.get<string>('AZURE_OPENAI_API_KEY', '') ?? '').trim();
    return { 'api-key': apiKey };
  }
  const apiKey = (config.get<string>('OPENAI_API_KEY', '') ?? '').trim();
  return { Authorization: `Bearer ${apiKey}` };
}

/**
 * Build the request URL for chat, responses, or embeddings.
 * Whisper uses {@link resolveWhisperUrl} (always api.openai.com).
 */
export function resolveOpenAiUrl(
  config: ConfigLike,
  kind: OpenAiUrlKind,
  modelName: string,
): string {
  if (kind === 'audio/transcriptions') {
    return resolveWhisperUrl();
  }
  if (getOpenAiApiMode(config) === 'azure') {
    const endpoint = (config.get<string>('AZURE_OPENAI_ENDPOINT', '') ?? '')
      .trim()
      .replace(/\/$/, '');
    const apiVersion =
      (config.get<string>('AZURE_OPENAI_API_VERSION', '2024-10-21') ?? '2024-10-21').trim() ||
      '2024-10-21';
    const deployment = encodeURIComponent(resolveAzureDeployment(config, modelName));
    return `${endpoint}/openai/deployments/${deployment}/${kind}?api-version=${encodeURIComponent(apiVersion)}`;
  }
  return `https://api.openai.com/v1/${kind}`;
}

/** Model field for OpenAI-compatible request bodies (not Whisper). */
export function resolveOpenAiRequestModel(
  config: ConfigLike,
  modelName: string,
): string {
  if (getOpenAiApiMode(config) === 'azure') {
    return resolveAzureDeployment(config, modelName);
  }
  return modelName;
}

/** Whisper always bills against OPENAI_API_KEY on api.openai.com. */
export function isWhisperConfigured(config: ConfigLike): boolean {
  return Boolean((config.get<string>('OPENAI_API_KEY', '') ?? '').trim());
}

export function whisperNotConfiguredMessage(): string {
  return 'Whisper is not configured. Set OPENAI_API_KEY (Whisper always uses OpenAI direct, not Azure).';
}

export function resolveWhisperUrl(): string {
  return 'https://api.openai.com/v1/audio/transcriptions';
}

export function resolveWhisperAuthHeaders(
  config: ConfigLike,
): Record<string, string> {
  const apiKey = (config.get<string>('OPENAI_API_KEY', '') ?? '').trim();
  return { Authorization: `Bearer ${apiKey}` };
}
