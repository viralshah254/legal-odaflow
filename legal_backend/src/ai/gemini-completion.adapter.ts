import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { LlmCompletionResult, LlmMessage } from './llm-completion.service';

type GoogleGenAIClient = InstanceType<
  Awaited<typeof import('@google/genai')>['GoogleGenAI']
>;

@Injectable()
export class GeminiCompletionAdapter {
  constructor(private readonly configService: ConfigService) {}

  isConfigured(): boolean {
    if (this.configService.get<string>('GOOGLE_AI_API_KEY')?.trim()) {
      return true;
    }
    const project = this.configService.get<string>('GOOGLE_CLOUD_PROJECT')?.trim();
    const location = this.vertexLocation();
    return Boolean(project && location);
  }

  private vertexLocation(): string | undefined {
    return (
      this.configService.get<string>('VERTEX_LOCATION')?.trim() ||
      this.configService.get<string>('GOOGLE_CLOUD_LOCATION')?.trim()
    );
  }

  defaultModelName(): string {
    const configured = (
      this.configService.get<string>('GEMINI_MODEL')?.trim() ||
      this.configService.get<string>('AI_LEGAL_FAST_MODEL')?.trim()
    );
    // Legacy task routing commonly names another provider's model. It is not
    // a valid Google model ID. Explicit Google selections remain respected.
    return configured?.startsWith('gemini-') ? configured : 'gemini-3.8-flash';
  }

  private async createClient(): Promise<GoogleGenAIClient> {
    const { GoogleGenAI } = await import('@google/genai');
    const apiKey = this.configService.get<string>('GOOGLE_AI_API_KEY')?.trim();
    if (apiKey) {
      return new GoogleGenAI({ apiKey });
    }

    const project = this.configService.get<string>('GOOGLE_CLOUD_PROJECT')?.trim();
    const location = this.vertexLocation();
    if (project && location) {
      // Uses Application Default Credentials (GOOGLE_APPLICATION_CREDENTIALS).
      return new GoogleGenAI({
        vertexai: true,
        project,
        location,
      });
    }

    throw new ServiceUnavailableException(
      'Google AI is not configured. Set GOOGLE_AI_API_KEY or GOOGLE_CLOUD_PROJECT + VERTEX_LOCATION (with ADC).',
    );
  }

  async complete(params: {
    modelName: string;
    messages: LlmMessage[];
    temperature?: number;
    maxTokens?: number;
    signal?: AbortSignal;
    responseFormat?: { type: string; json_schema?: { schema: Record<string, unknown> } };
  }): Promise<LlmCompletionResult> {
    const client = await this.createClient();
    const modelName =
      params.modelName.startsWith('gemini-') || params.modelName.includes('gemini')
        ? params.modelName
        : this.defaultModelName();

    const system = params.messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n\n');
    const contents = params.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? ('model' as const) : ('user' as const),
        parts: [{ text: m.content }],
      }));

    const response = await client.models.generateContent({
      model: modelName,
      contents,
      config: {
        abortSignal: params.signal,
        responseMimeType: params.responseFormat ? 'application/json' : undefined,
        responseJsonSchema: params.responseFormat?.json_schema?.schema,
        temperature: params.temperature ?? 0.2,
        maxOutputTokens: params.maxTokens ?? 4096,
        systemInstruction: system || undefined,
      },
    });

    const text = response.text ?? '';
    const usage = response.usageMetadata;
    const inputTokens = usage?.promptTokenCount ?? 0;
    const outputTokens = (usage?.candidatesTokenCount ?? 0) + (usage?.thoughtsTokenCount ?? 0);

    return {
      content: text,
      inputTokens,
      outputTokens,
      provider: 'google',
      modelName,
      finishReason: response.candidates?.[0]?.finishReason === 'MAX_TOKENS' ? 'max_tokens' : text ? 'stop' : 'unknown',
    };
  }

  async completeWithTools(params: {
    modelName: string;
    messages: LlmMessage[];
    tools: Array<{ name: string; description: string; parameters: Record<string, unknown> }>;
    temperature?: number;
  }): Promise<{ toolName: string | null; toolArgs: Record<string, unknown>; textContent: string }> {
    const client = await this.createClient();
    const response = await client.models.generateContent({
      model: params.modelName,
      contents: params.messages.filter((m) => m.role !== 'system').map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }],
      })),
      config: {
        systemInstruction: params.messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n'),
        temperature: params.temperature ?? 0.2,
        tools: [{ functionDeclarations: params.tools.map((tool) => ({
          name: tool.name, description: tool.description, parametersJsonSchema: tool.parameters,
        })) }],
      },
    });
    const call = response.functionCalls?.[0];
    if (call && !params.tools.some((tool) => tool.name === call.name)) {
      throw new ServiceUnavailableException('Invalid tool response');
    }
    return { toolName: call?.name ?? null, toolArgs: call?.args ?? {}, textContent: response.text ?? '' };
  }

  /**
   * Real streaming using generateContentStream.
   * C08/B06 fix: replaces the fake stream() that waited for full completion
   * and yielded a single chunk.  Now yields text deltas progressively as the
   * model generates them, matching the OpenAI streaming contract.
   */
  async *stream(params: {
    modelName: string;
    messages: LlmMessage[];
    temperature?: number;
    maxTokens?: number;
  }): AsyncGenerator<{ delta: string; done?: boolean }> {
    const client = await this.createClient();
    const modelName =
      params.modelName.startsWith('gemini-') || params.modelName.includes('gemini')
        ? params.modelName
        : this.defaultModelName();

    const system = params.messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n\n');
    const contents = params.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? ('model' as const) : ('user' as const),
        parts: [{ text: m.content }],
      }));

    try {
      const streamResult = await client.models.generateContentStream({
        model: modelName,
        contents,
        config: {
          temperature: params.temperature ?? 0.2,
          maxOutputTokens: params.maxTokens ?? 4096,
          systemInstruction: system || undefined,
        },
      });

      for await (const chunk of streamResult) {
        const delta = chunk.text ?? '';
        if (delta) yield { delta };
      }
    } catch (err) {
      // Propagate structured errors; provider failure must not look like success.
      throw err;
    }

    yield { delta: '', done: true };
  }

  /**
   * Multimodal completion: text + inline image data (base64).
   * C08 addition: supports vision capability required for document attachments.
   */
  async completeWithImage(params: {
    modelName: string;
    messages: LlmMessage[];
    imageParts: Array<{ mimeType: string; data: string }>;
    temperature?: number;
    maxTokens?: number;
  }): Promise<LlmCompletionResult> {
    const client = await this.createClient();
    const modelName =
      params.modelName.startsWith('gemini-') || params.modelName.includes('gemini')
        ? params.modelName
        : this.defaultModelName();

    const system = params.messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n\n');

    // Build a user message with mixed text + image parts
    const textParts = params.messages
      .filter((m) => m.role === 'user')
      .map((m) => ({ text: m.content }));

    const imageParts = params.imageParts.map((img) => ({
      inlineData: { mimeType: img.mimeType, data: img.data },
    }));

    const contents = [
      ...params.messages
        .filter((m) => m.role === 'assistant')
        .map((m) => ({
          role: 'model' as const,
          parts: [{ text: m.content }],
        })),
      {
        role: 'user' as const,
        parts: [...textParts, ...imageParts],
      },
    ];

    const response = await client.models.generateContent({
      model: modelName,
      contents,
      config: {
        temperature: params.temperature ?? 0.2,
        maxOutputTokens: params.maxTokens ?? 4096,
        systemInstruction: system || undefined,
      },
    });

    const text = response.text ?? '';
    return {
      content: text,
      inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: (response.usageMetadata?.candidatesTokenCount ?? 0) + (response.usageMetadata?.thoughtsTokenCount ?? 0),
      provider: 'google',
      modelName,
      finishReason: response.candidates?.[0]?.finishReason === 'MAX_TOKENS' ? 'max_tokens' : text ? 'stop' : 'unknown',
    };
  }
}
