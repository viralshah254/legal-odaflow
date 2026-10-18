export type ModelCapability =
  | 'classification'
  | 'extraction'
  | 'summarization'
  | 'ranking'
  | 'reasoning'
  | 'long_context'
  | 'generation'
  | 'verification'
  | 'multilingual'
  | 'vision'
  | 'structured_output';

export interface GenerateOptions {
  model: string;
  provider: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'text' | 'json_object';
  stream?: boolean;
  systemPrompt?: string;
}

export interface GenerateResult {
  content: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
  provider: string;
  finishReason: string;
  costUsd: number;
}

export interface CostEstimate {
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  model: string;
  provider: string;
}

export interface AiGateway {
  generate(options: GenerateOptions): Promise<GenerateResult>;
  stream(options: GenerateOptions): AsyncGenerator<string>;
  estimateCost(
    options: Pick<GenerateOptions, 'model' | 'provider'>,
    inputTokens: number,
    maxOutputTokens: number,
  ): CostEstimate;
  healthCheck(provider: string): Promise<{ healthy: boolean; latencyMs: number }>;
}

export const AI_GATEWAY = Symbol('AI_GATEWAY');
