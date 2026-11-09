import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { estimateTokens } from '@/common/utils/prompt-hash.util';
import {
  isAbortError,
  LLM_DEADLINE_MESSAGE,
  parseRetryAfterMs,
  postWithRateLimitRetry,
} from './llm-retry.util';
import { buildLlmFallbackChain } from './llm-fallback.config';
import {
  ALLOWED_AI_PROVIDERS,
  AiLlmProvider,
  isAllowedAiProvider,
  meetsModelFloor,
  getModelTier,
  normalizeModelId,
  resolveModelProvider,
  type ModelTier,
} from './model-costs.config';
import {
  deepSeekNotConfiguredMessage,
  isDeepSeekConfigured,
  isOpenAiConfigured,
  isWhisperConfigured,
  openAiNotConfiguredMessage,
  resolveOpenAiAuthHeaders,
  resolveOpenAiRequestModel,
  resolveOpenAiUrl,
  resolveWhisperAuthHeaders,
  resolveWhisperUrl,
  whisperNotConfiguredMessage,
} from './openai-transport';
import { GeminiCompletionAdapter } from './gemini-completion.adapter';

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * A single block in a multi-part system prompt (optional per-block cache hints).
 */
export interface LlmSystemBlock {
  text: string;
  cache?: boolean;
}

export type LlmFinishReason = 'stop' | 'max_tokens' | 'end_turn' | 'length' | 'unknown';

export interface LlmCompletionResult {
  content: string;
  inputTokens: number;
  outputTokens: number;
  provider: AiLlmProvider;
  modelName: string;
  finishReason: LlmFinishReason;
}

type ReasoningEffort = 'none' | 'low' | 'medium' | 'high' | 'xhigh' | 'max';
type LlmResponseFormat =
  | { type: 'json_object' }
  | {
      type: 'json_schema';
      json_schema: {
        name: string;
        strict?: boolean;
        schema: Record<string, unknown>;
      };
    };

function isGpt55Family(modelName: string): boolean {
  return modelName.startsWith('gpt-5.5');
}

/** GPT-5.6 Sol — flagship reasoning; use Responses API like GPT-5.5. */
function isGpt56Sol(modelName: string): boolean {
  return modelName === 'gpt-5.6-sol' || modelName.startsWith('gpt-5.6-sol');
}

/**
 * All GPT-5.x models (4, 5, 6 sub-versions) require `max_completion_tokens`
 * instead of the legacy `max_tokens`. This applies to gpt-5.4-mini, gpt-5.6-*, etc.
 */
function isGpt5xFamily(modelName: string): boolean {
  return /^gpt-5\.\d/.test(modelName);
}

function resolveDefaultReasoningEffort(modelName: string): ReasoningEffort {
  if (modelName.startsWith('gpt-5.5-pro') || isGpt56Sol(modelName)) return 'xhigh';
  if (isGpt55Family(modelName) || modelName.startsWith('gpt-5.6-terra')) return 'high';
  if (modelName.startsWith('gpt-5.6-luna')) return 'medium';
  return 'medium';
}

/**
 * GPT-5.5 family and GPT-5.6 Sol must be called through the Responses API
 * (/v1/responses). The chat completions endpoint does not accept the
 * `reasoning` parameter that these models require.
 */
function requiresOpenAiResponsesApi(modelName: string): boolean {
  return isGpt55Family(modelName) || isGpt56Sol(modelName);
}

/** Clamp our internal reasoning effort to values accepted by the OpenAI Responses API. */
function toOpenAiResponsesEffort(
  effort: ReasoningEffort,
): 'minimal' | 'low' | 'medium' | 'high' {
  switch (effort) {
    case 'none':
      return 'minimal';
    case 'low':
      return 'low';
    case 'medium':
      return 'medium';
    // 'high' | 'xhigh' | 'max' — the Responses API tops out at 'high'.
    default:
      return 'high';
  }
}

interface OpenAiResponsesPayload {
  output_text?: string;
  output?: Array<{
    type?: string;
    name?: string;
    arguments?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
  usage?: { input_tokens?: number; output_tokens?: number };
}

/** Extract assistant text from an OpenAI Responses API payload. */
function extractResponsesText(payload: OpenAiResponsesPayload): string {
  if (typeof payload.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text;
  }
  const texts: string[] = [];
  for (const item of payload.output ?? []) {
    if (item?.type === 'message' && Array.isArray(item.content)) {
      for (const part of item.content) {
        if (part?.type === 'output_text' && typeof part.text === 'string') {
          texts.push(part.text);
        }
      }
    }
  }
  return texts.join('\n').trim();
}

function coercePositiveInt(value: number | string | undefined | null): number | undefined {
  if (value == null || value === '') return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return Math.floor(parsed);
}

@Injectable()
export class LlmCompletionService {
  private readonly logger = new Logger(LlmCompletionService.name);

  constructor(private readonly configService: ConfigService) {}

  private configuredModel(modelName: string, minTier?: ModelTier): string {
    if (this.configService.get<string>('AI_PROVIDER') !== 'google') return normalizeModelId(modelName);
    if (modelName.startsWith('gemini-')) return modelName;
    const tier = minTier ?? getModelTier(modelName);
    const reasoning = tier === 'premium' || tier === 'reasoning';
    return this.configService.get<string>(reasoning ? 'GEMINI_REASONING_MODEL' : 'GEMINI_MODEL')
      || (reasoning ? 'gemini-3.1-pro-preview' : 'gemini-3.8-flash');
  }

  getAllowedProviders(): AiLlmProvider[] {
    if (this.configService.get<string>('AI_PROVIDER') === 'google') return ['google'];
    const configured = this.configService
      .get<string>('AI_ALLOWED_PROVIDERS', 'openai,deepseek,google')
      .split(',')
      .map((p) => p.trim().toLowerCase())
      .filter(Boolean);

    return configured.filter(isAllowedAiProvider);
  }

  assertProviderAllowed(provider: string): AiLlmProvider {
    const normalized = provider.toLowerCase();
    if (!isAllowedAiProvider(normalized)) {
      throw new BadRequestException(
        `AI provider "${provider}" is not allowed. Supported: ${ALLOWED_AI_PROVIDERS.join(', ')}`,
      );
    }
    if (!this.getAllowedProviders().includes(normalized)) {
      throw new BadRequestException(
        `AI provider "${provider}" is disabled. Enabled: ${this.getAllowedProviders().join(', ')}`,
      );
    }
    return normalized;
  }

  isProviderConfigured(provider: AiLlmProvider): boolean {
    if (provider === 'openai') {
      return isOpenAiConfigured(this.configService);
    }
    if (provider === 'google') {
      return new GeminiCompletionAdapter(this.configService).isConfigured();
    }
    return isDeepSeekConfigured(this.configService);
  }

  isModelConfigured(modelName: string): boolean {
    return this.isProviderConfigured(resolveModelProvider(this.configuredModel(modelName)));
  }

  assertModelConfigured(modelName: string): void {
    const provider = resolveModelProvider(this.configuredModel(modelName));
    this.assertProviderAllowed(provider);
    const isProd = this.configService.get<string>('NODE_ENV') === 'production';
    const allowMock = this.configService.get<string>('ALLOW_MOCK_AI', 'false') === 'true';

    if (!this.isProviderConfigured(provider) && isProd && !allowMock) {
      const message =
        provider === 'deepseek'
          ? deepSeekNotConfiguredMessage()
          : openAiNotConfiguredMessage(this.configService);
      throw new ServiceUnavailableException(message);
    }
  }

  shouldUseMockForModel(modelName: string): boolean {
    if (this.isModelConfigured(modelName)) return false;
    const isProd = this.configService.get<string>('NODE_ENV') === 'production';
    return !isProd || this.configService.get<string>('ALLOW_MOCK_AI', 'false') === 'true';
  }

  async complete(params: {
    modelName: string;
    messages: LlmMessage[];
    /** Multi-block system prompt (optional per-block cache hints). */
    systemBlocks?: LlmSystemBlock[];
    temperature?: number;
    maxTokens?: number;
    store?: boolean;
    reasoningEffort?: ReasoningEffort;
    responseFormat?: LlmResponseFormat;
    /**
     * Refuse to fall back below this capability tier. Work whose whole value is
     * the quality of the reasoning — verified research, filing-grade drafting —
     * must fail loudly rather than quietly answer from a cheap model.
     */
    minTier?: ModelTier;
    timeoutMs?: number;
    signal?: AbortSignal;
  }): Promise<LlmCompletionResult> {
    const timeout = this.bindTimeout(params.timeoutMs, params.signal);
    try {
      return await this.completeWithBoundSignal({ ...params, signal: timeout.signal });
    } catch (err) {
      if (timeout.signal.aborted || isAbortError(err)) {
        throw new Error(LLM_DEADLINE_MESSAGE);
      }
      throw err;
    } finally {
      timeout.clear();
    }
  }

  private bindTimeout(timeoutMs?: number, existing?: AbortSignal): {
    signal: AbortSignal;
    clear: () => void;
  } {
    const controller = new AbortController();
    const onExistingAbort = () => controller.abort(existing?.reason);
    if (existing?.aborted) {
      controller.abort(existing.reason);
    } else {
      existing?.addEventListener('abort', onExistingAbort, { once: true });
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (timeoutMs && timeoutMs > 0 && !controller.signal.aborted) {
      timer = setTimeout(() => controller.abort(new Error(LLM_DEADLINE_MESSAGE)), timeoutMs);
    }
    return {
      signal: controller.signal,
      clear: () => {
        if (timer) clearTimeout(timer);
        existing?.removeEventListener('abort', onExistingAbort);
      },
    };
  }

  private async completeWithBoundSignal(params: {
    modelName: string;
    messages: LlmMessage[];
    systemBlocks?: LlmSystemBlock[];
    temperature?: number;
    maxTokens?: number;
    store?: boolean;
    reasoningEffort?: ReasoningEffort;
    responseFormat?: LlmResponseFormat;
    minTier?: ModelTier;
    signal?: AbortSignal;
  }): Promise<LlmCompletionResult> {
    const resolvedModel = this.configuredModel(params.modelName, params.minTier);
    const provider = this.assertProviderAllowed(resolveModelProvider(resolvedModel));
    const normalizedParams = {
      ...params,
      modelName: resolvedModel,
      maxTokens: coercePositiveInt(params.maxTokens),
    };

    if (this.shouldUseMockForModel(params.modelName)) {
      const userContent =
        [...params.messages].reverse().find((m) => m.role === 'user')?.content ?? '';
      const mockContent = `Mock response (${provider}/${params.modelName}): configure API keys for live output.\n\n> ${userContent.slice(0, 200)}`;
      return {
        content: mockContent,
        inputTokens: estimateTokens(params.messages.map((m) => m.content).join('\n')),
        outputTokens: estimateTokens(mockContent),
        provider,
        modelName: params.modelName,
        finishReason: 'stop' as LlmFinishReason,
      };
    }

    // Try primary model, then fall back on rate-limits OR any provider-level failure
    // (e.g. OpenAI 401/500, network errors). Business-logic errors (403 budget, 400
    // validation) are NOT provider failures and are re-thrown immediately.
    const candidates = [
      normalizedParams.modelName,
      ...buildLlmFallbackChain(normalizedParams.modelName),
    ];
    const modelsToTry = params.minTier
      ? candidates.filter((model) => meetsModelFloor(model, params.minTier!))
      : candidates;
    if (params.minTier && modelsToTry.length < candidates.length) {
      this.logger.warn(
        `[LlmFloor] Dropped ${candidates.length - modelsToTry.length} fallback model(s) below "${params.minTier}" tier for ${normalizedParams.modelName}`,
      );
    }
    let lastError: unknown;

    for (const modelName of modelsToTry) {
      const modelProvider = resolveModelProvider(modelName);
      if (!this.getAllowedProviders().includes(modelProvider) || !this.isProviderConfigured(modelProvider)) continue;
      try {
        const attempt = { ...normalizedParams, modelName, signal: params.signal };
        if (modelProvider === 'deepseek') {
          return await this.completeDeepSeek(attempt);
        }
        if (modelProvider === 'google') {
          return await new GeminiCompletionAdapter(this.configService).complete({
            ...attempt,
            messages: params.systemBlocks?.length
              ? [{ role: 'system', content: params.systemBlocks.map((block) => block.text).join('\n\n') }, ...params.messages]
              : params.messages,
          });
        }
        return await this.completeOpenAi(attempt);
      } catch (err) {
        if (params.signal?.aborted || isAbortError(err)) {
          throw new Error(LLM_DEADLINE_MESSAGE);
        }
        const isRateLimit =
          (err instanceof HttpException &&
            (err.getResponse() as Record<string, unknown>)?.code === 'RATE_LIMIT_FALLBACK_NEEDED') ||
          (err instanceof Error && (err.message.includes('rate limit') || err.message.includes('rate_limit')));

        // Provider-level failures that should trigger fallback (not business-logic rejections)
        const httpStatus = err instanceof HttpException ? err.getStatus() : 0;
        const isProviderFailure =
          isRateLimit ||
          // Auth / key errors from the upstream provider
          httpStatus === 401 ||
          httpStatus === 403 ||
          // Upstream 5xx — provider down / overloaded
          (httpStatus >= 500 && httpStatus <= 599) ||
          // Low-level network errors (no HTTP status)
          (err instanceof Error &&
            (err.message.includes('ECONNREFUSED') ||
              err.message.includes('ETIMEDOUT') ||
              err.message.includes('fetch failed') ||
              err.message.includes('network') ||
              // postWithRateLimitRetry throws "OpenAI/Anthropic request failed: ..."
              // for all non-2xx non-rate-limit provider responses (auth, 5xx, model
              // not found, etc.) — treat these as provider failures so the fallback
              // chain continues rather than propagating a hard 500.
              err.message.includes('request failed')));

        if (isProviderFailure) {
          lastError = err;
          console.warn(
            `[LlmFallback] ${modelName} unavailable (${err instanceof Error ? err.message : String(err)}), trying next model`,
          );
          continue;
        }
        throw err;
      }
    }

    // All models exhausted — surface as a proper 503 so NestJS returns a clean HTTP
    // error instead of a generic 500 (raw Error re-throw).
    const lastErrMsg = lastError instanceof Error ? lastError.message : String(lastError ?? 'unknown');
    console.error(`[LlmFallback] All fallback models exhausted. Last error: ${lastErrMsg}`);
    if (params.minTier) {
      // Say so explicitly: this is a refusal to downgrade, not an outage.
      throw new ServiceUnavailableException(
        'The required analysis capability is temporarily unavailable. Please try again shortly.',
      );
    }
    if (lastError instanceof HttpException) throw lastError;
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
    throw new ServiceUnavailableException(
      isProduction
        ? 'AI service is temporarily unavailable. Please try again in a moment.'
        : `AI service temporarily unavailable — all models failed. Last error: ${lastErrMsg}`,
    );
  }

  private getMaxRetries(): number {
    const configured = Number(this.configService.get<string>('AI_LLM_MAX_RETRIES', '6'));
    return Number.isFinite(configured) && configured > 0 ? configured : 6;
  }

  private async postWithRateLimitRetry(
    url: string,
    init: RequestInit,
    providerLabel: string,
  ): Promise<Response> {
    return postWithRateLimitRetry(url, init, providerLabel, {
      maxAttempts: this.getMaxRetries(),
      // Do not hard-fail on rate limit — let the caller's fallback chain handle it
      onRateLimitExhausted: (errorText) => {
        const retryMs = parseRetryAfterMs(errorText);
        throw new HttpException(
          { message: 'rate_limit_exhausted', code: 'RATE_LIMIT_FALLBACK_NEEDED', retryMs },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      },
    });
  }

  private async completeOpenAi(params: {
    modelName: string;
    messages: LlmMessage[];
    temperature?: number;
    maxTokens?: number;
    store?: boolean;
    reasoningEffort?: ReasoningEffort;
    responseFormat?: LlmResponseFormat;
    signal?: AbortSignal;
  }): Promise<LlmCompletionResult> {
    if (!isOpenAiConfigured(this.configService)) {
      throw new ServiceUnavailableException(openAiNotConfiguredMessage(this.configService));
    }

    // Responses-API-only models (e.g. GPT-5.5 Pro) must not hit /v1/chat/completions.
    if (requiresOpenAiResponsesApi(params.modelName)) {
      return this.completeOpenAiResponses(params);
    }

    const effort = params.reasoningEffort ?? resolveDefaultReasoningEffort(params.modelName);
    const requestBody: Record<string, unknown> = {
      model: resolveOpenAiRequestModel(this.configService, params.modelName),
      store: params.store ?? false,
      messages: params.messages,
    };
    if (params.responseFormat) {
      requestBody.response_format = params.responseFormat;
    }

    if (isGpt55Family(params.modelName)) {
      // GPT-5.5 family: reasoning model — uses `reasoning` object + max_completion_tokens
      requestBody.reasoning = { effort };
      if (params.maxTokens != null) {
        requestBody.max_completion_tokens = params.maxTokens;
      }
    } else if (isGpt5xFamily(params.modelName)) {
      requestBody.reasoning_effort = effort;
      // GPT-5.x chat models require max_completion_tokens and several hosted
      // variants reject non-default temperature values. Omit temperature.
      if (params.maxTokens != null) {
        requestBody.max_completion_tokens = params.maxTokens;
      }
    } else {
      requestBody.temperature = params.temperature ?? 0.2;
      if (params.maxTokens != null) {
        requestBody.max_tokens = params.maxTokens;
      }
    }

    const response = await this.postWithRateLimitRetry(
      resolveOpenAiUrl(this.configService, 'chat/completions', params.modelName),
      {
        method: 'POST',
        headers: {
          ...resolveOpenAiAuthHeaders(this.configService),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: params.signal,
      },
      'OpenAI',
    );

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };

    const content = payload.choices?.[0]?.message?.content ?? '';
    if (!content.trim()) {
      throw new ServiceUnavailableException({ code: 'EMPTY_MODEL_OUTPUT', message: 'Model returned no visible output' });
    }

    const rawFinish = payload.choices?.[0]?.finish_reason ?? 'unknown';
    const finishReason: LlmFinishReason =
      rawFinish === 'stop' ? 'stop'
      : rawFinish === 'length' || rawFinish === 'max_tokens' ? 'max_tokens'
      : 'unknown';

    return {
      content,
      inputTokens: payload.usage?.prompt_tokens ?? estimateTokens(JSON.stringify(params.messages)),
      outputTokens: payload.usage?.completion_tokens ?? estimateTokens(content),
      provider: 'openai',
      modelName: params.modelName,
      finishReason,
    };
  }

  /**
   * OpenAI Responses API (/v1/responses) — required for all GPT-5.5 family models.
   * The chat completions endpoint does not accept the `reasoning` parameter.
   */
  private async completeOpenAiResponses(
    params: {
      modelName: string;
      messages: LlmMessage[];
      maxTokens?: number;
      store?: boolean;
      reasoningEffort?: ReasoningEffort;
      responseFormat?: LlmResponseFormat;
      signal?: AbortSignal;
    },
  ): Promise<LlmCompletionResult> {
    const effort = params.reasoningEffort ?? resolveDefaultReasoningEffort(params.modelName);

    const systemParts = params.messages.filter((m) => m.role === 'system');
    const inputMessages = params.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role, content: m.content }));

    const requestBody: Record<string, unknown> = {
      model: resolveOpenAiRequestModel(this.configService, params.modelName),
      store: params.store ?? false,
      input:
        inputMessages.length > 0
          ? inputMessages
          : [{ role: 'user', content: 'Hello' }],
      reasoning: { effort: toOpenAiResponsesEffort(effort) },
      // Reasoning models spend part of this budget on hidden reasoning tokens, so
      // enforce a floor to avoid empty completions when callers pass a tiny cap.
      max_output_tokens: Math.max(params.maxTokens ?? 8192, 2048),
    };

    if (params.responseFormat) {
      requestBody.text = { format: params.responseFormat.type === 'json_schema'
        ? { type: 'json_schema', ...params.responseFormat.json_schema }
        : { type: 'json_object' } };
    }

    if (systemParts.length > 0) {
      requestBody.instructions = systemParts.map((m) => m.content).join('\n\n');
    }

    const response = await this.postWithRateLimitRetry(
      resolveOpenAiUrl(this.configService, 'responses', params.modelName),
      {
        method: 'POST',
        headers: {
          ...resolveOpenAiAuthHeaders(this.configService),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: params.signal,
      },
      'OpenAI',
    );

    const payload = (await response.json()) as OpenAiResponsesPayload;
    const content = extractResponsesText(payload);
    if (!content.trim()) {
      throw new ServiceUnavailableException({ code: 'EMPTY_MODEL_OUTPUT', message: 'Model returned no visible output' });
    }

    const rawStatus = (payload as Record<string, unknown>).status as string | undefined;
    const finishReason: LlmFinishReason =
      rawStatus === 'incomplete' ? 'max_tokens'
      : rawStatus === 'completed' ? 'stop'
      : 'unknown';

    return {
      content,
      inputTokens:
        payload.usage?.input_tokens ?? estimateTokens(JSON.stringify(params.messages)),
      outputTokens: payload.usage?.output_tokens ?? estimateTokens(content),
      provider: 'openai',
      modelName: params.modelName,
      finishReason,
    };
  }

  /**
   * DeepSeek uses an OpenAI-compatible chat completions API.
   * Always uses DEEPSEEK_API_KEY + DEEPSEEK_BASE_URL (never Azure).
   */
  private async completeDeepSeek(params: {
    modelName: string;
    messages: LlmMessage[];
    temperature?: number;
    maxTokens?: number;
    signal?: AbortSignal;
  }): Promise<LlmCompletionResult> {
    const apiKey = this.configService.get<string>('DEEPSEEK_API_KEY', '').trim();
    if (!apiKey) {
      throw new ServiceUnavailableException(deepSeekNotConfiguredMessage());
    }
    const baseUrl = this.configService
      .get<string>('DEEPSEEK_BASE_URL', 'https://api.deepseek.com')
      .replace(/\/$/, '');

    const requestBody: Record<string, unknown> = {
      model: params.modelName,
      messages: params.messages,
      temperature: params.temperature ?? 0.2,
    };
    if (params.maxTokens != null) {
      requestBody.max_tokens = params.maxTokens;
    }

    const response = await this.postWithRateLimitRetry(
      `${baseUrl}/v1/chat/completions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: params.signal,
      },
      'DeepSeek',
    );

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };

    const content = payload.choices?.[0]?.message?.content ?? '';
    if (!content.trim()) {
      throw new ServiceUnavailableException({ code: 'EMPTY_MODEL_OUTPUT', message: 'Model returned no visible output' });
    }

    const rawFinish = payload.choices?.[0]?.finish_reason ?? 'unknown';
    const finishReason: LlmFinishReason =
      rawFinish === 'stop' ? 'stop'
      : rawFinish === 'length' ? 'max_tokens'
      : 'unknown';

    return {
      content,
      inputTokens: payload.usage?.prompt_tokens ?? estimateTokens(JSON.stringify(params.messages)),
      outputTokens: payload.usage?.completion_tokens ?? estimateTokens(content),
      provider: 'deepseek',
      modelName: params.modelName,
      finishReason,
    };
  }

  async completeWithTools(params: {
    modelName: string;
    messages: LlmMessage[];
    tools: Array<{
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    }>;
    temperature?: number;
  }): Promise<{ toolName: string | null; toolArgs: Record<string, unknown>; textContent: string }> {
    const resolvedModel = this.configuredModel(params.modelName);
    const provider = this.assertProviderAllowed(resolveModelProvider(resolvedModel));

    if (this.shouldUseMockForModel(resolvedModel)) {
      return { toolName: null, toolArgs: {}, textContent: 'Mock: tool calling not available in dev mode without API keys.' };
    }

    if (provider === 'google') {
      return new GeminiCompletionAdapter(this.configService).completeWithTools({ ...params, modelName: resolvedModel });
    }
    if (provider !== 'openai') {
      throw new BadRequestException('Tool calling is only supported for OpenAI models.');
    }
    return this.completeOpenAiWithTools({ ...params, modelName: resolvedModel });
  }

  private async completeOpenAiWithTools(params: {
    modelName: string;
    messages: LlmMessage[];
    tools: Array<{ name: string; description: string; parameters: Record<string, unknown> }>;
    temperature?: number;
  }): Promise<{ toolName: string | null; toolArgs: Record<string, unknown>; textContent: string }> {
    if (!isOpenAiConfigured(this.configService)) {
      throw new ServiceUnavailableException(openAiNotConfiguredMessage(this.configService));
    }

    if (requiresOpenAiResponsesApi(params.modelName)) {
      return this.completeOpenAiResponsesWithTools(params);
    }

    const openAiTools = params.tools.map((t) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));

    const requestBody: Record<string, unknown> = {
      model: resolveOpenAiRequestModel(this.configService, params.modelName),
      messages: params.messages,
      tools: openAiTools,
      tool_choice: 'auto',
    };

    if (isGpt55Family(params.modelName)) {
      requestBody.reasoning = {
        effort: resolveDefaultReasoningEffort(params.modelName),
      };
    } else {
      requestBody.temperature = params.temperature ?? 0.1;
    }

    const response = await this.postWithRateLimitRetry(
      resolveOpenAiUrl(this.configService, 'chat/completions', params.modelName),
      {
        method: 'POST',
        headers: {
          ...resolveOpenAiAuthHeaders(this.configService),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      },
      'OpenAI',
    );

    const payload = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?: string | null;
          tool_calls?: Array<{ function?: { name?: string; arguments?: string } }>;
        };
      }>;
    };

    const msg = payload.choices?.[0]?.message;
    const toolCall = msg?.tool_calls?.[0]?.function;

    if (toolCall?.name) {
      let toolArgs: Record<string, unknown> = {};
      try {
        toolArgs = JSON.parse(toolCall.arguments ?? '{}') as Record<string, unknown>;
      } catch {
        toolArgs = {};
      }
      return { toolName: toolCall.name, toolArgs, textContent: msg?.content ?? '' };
    }

    return { toolName: null, toolArgs: {}, textContent: msg?.content ?? '' };
  }

  /** Tool calling via the OpenAI Responses API for Responses-only models (e.g. GPT-5.5 Pro). */
  private async completeOpenAiResponsesWithTools(
    params: {
      modelName: string;
      messages: LlmMessage[];
      tools: Array<{ name: string; description: string; parameters: Record<string, unknown> }>;
      temperature?: number;
    },
  ): Promise<{ toolName: string | null; toolArgs: Record<string, unknown>; textContent: string }> {
    // Responses API uses a flat function-tool shape (no nested `function` object).
    const responsesTools = params.tools.map((t) => ({
      type: 'function' as const,
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }));

    const systemParts = params.messages.filter((m) => m.role === 'system');
    const inputMessages = params.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role, content: m.content }));

    const requestBody: Record<string, unknown> = {
      model: resolveOpenAiRequestModel(this.configService, params.modelName),
      input: inputMessages.length > 0 ? inputMessages : [{ role: 'user', content: 'Hello' }],
      tools: responsesTools,
      tool_choice: 'auto',
      reasoning: {
        effort: toOpenAiResponsesEffort(resolveDefaultReasoningEffort(params.modelName)),
      },
    };

    if (systemParts.length > 0) {
      requestBody.instructions = systemParts.map((m) => m.content).join('\n\n');
    }

    const response = await this.postWithRateLimitRetry(
      resolveOpenAiUrl(this.configService, 'responses', params.modelName),
      {
        method: 'POST',
        headers: {
          ...resolveOpenAiAuthHeaders(this.configService),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      },
      'OpenAI',
    );

    const payload = (await response.json()) as OpenAiResponsesPayload;

    const fnCall = (payload.output ?? []).find((item) => item?.type === 'function_call');
    if (fnCall?.name) {
      let toolArgs: Record<string, unknown> = {};
      try {
        toolArgs = JSON.parse(fnCall.arguments ?? '{}') as Record<string, unknown>;
      } catch {
        toolArgs = {};
      }
      return { toolName: fnCall.name, toolArgs, textContent: extractResponsesText(payload) };
    }

    return { toolName: null, toolArgs: {}, textContent: extractResponsesText(payload) };
  }

  /**
   * Transcribes an audio buffer using OpenAI Whisper (model: whisper-1).
   * Always uses api.openai.com + OPENAI_API_KEY (never Azure), so Whisper
   * bills against OpenAI credits even when OPENAI_API_MODE=azure.
   * Accepts webm / mp3 / wav / m4a / ogg up to 25 MB.
   */
  async transcribeAudio(
    buffer: Buffer,
    opts: { lang: string; mimeType: string },
  ): Promise<{ text: string; segments: Array<{ id: number; start: number; end: number; text: string }> }> {
    if (!isWhisperConfigured(this.configService)) {
      throw new ServiceUnavailableException(whisperNotConfiguredMessage());
    }

    const whisperModel = 'whisper-1';
    const ext = opts.mimeType.split('/')[1]?.split(';')[0] ?? 'webm';
    const filename = `recording.${ext}`;

    const formData = new FormData();
    formData.append('model', whisperModel);
    formData.append('language', opts.lang.split('-')[0]);
    formData.append('response_format', 'verbose_json');
    formData.append(
      'file',
      new Blob([new Uint8Array(buffer)], { type: opts.mimeType }),
      filename,
    );

    const response = await fetch(resolveWhisperUrl(), {
      method: 'POST',
      headers: resolveWhisperAuthHeaders(this.configService),
      body: formData,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new HttpException(
        `Whisper transcription failed (${response.status}): ${text}`,
        HttpStatus.BAD_GATEWAY,
      );
    }

    const json = (await response.json()) as {
      text?: string;
      segments?: Array<{ id: number; start: number; end: number; text: string }>;
    };
    return {
      text: (json.text ?? '').trim(),
      segments: json.segments ?? [],
    };
  }
}
