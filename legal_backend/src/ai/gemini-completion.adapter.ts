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
    return (
      this.configService.get<string>('GEMINI_MODEL')?.trim() ||
      this.configService.get<string>('AI_LEGAL_FAST_MODEL')?.trim() ||
      'gemini-2.5-flash'
    );
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
        temperature: params.temperature ?? 0.2,
        maxOutputTokens: params.maxTokens ?? 4096,
        systemInstruction: system || undefined,
      },
    });

    const text = response.text ?? '';
    const inputTokens = Math.ceil(
      params.messages.reduce((sum, m) => sum + m.content.length, 0) / 4,
    );
    const outputTokens = Math.ceil(text.length / 4);

    return {
      content: text,
      inputTokens,
      outputTokens,
      provider: 'google',
      modelName,
      finishReason: text ? 'stop' : 'unknown',
    };
  }
}
