import { createHash } from 'crypto';

export function hashPrompt(prompt: string): string {
  return createHash('sha256').update(prompt).digest('hex');
}

export function estimateTokens(text: string): number {
  if (!text) {
    return 0;
  }
  return Math.max(1, Math.ceil(text.length / 4));
}

export function estimateCostUsd(
  inputTokens: number,
  outputTokens: number,
  inputRatePer1k = 0.003,
  outputRatePer1k = 0.012,
): number {
  return (inputTokens / 1000) * inputRatePer1k + (outputTokens / 1000) * outputRatePer1k;
}
