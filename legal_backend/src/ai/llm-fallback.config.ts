import { DEFAULT_AUTO_MODEL, DEFAULT_ECONOMY_MODEL, resolveModelProvider } from './model-costs.config';

/**
 * Proven legacy models to try when GPT-5.6 / GPT-5.5 deployments are missing
 * (e.g. Azure 404 for unmapped deployment names).
 */
export const UNAVAILABLE_MODEL_LEGACY_FALLBACKS: Record<string, string[]> = {
  'gpt-5.6-luna': ['gpt-4o-mini'],
  'gpt-5.6-terra': ['gpt-4o-mini'],
  // Prefer mid-tier OpenAI immediately on Sol 404 — avoid long deepseek-first retries.
  'gpt-5.6-sol': [DEFAULT_AUTO_MODEL, 'gpt-4o-mini', 'gpt-4o'],
  'gpt-5.5-pro': ['gpt-4o'],
  'gpt-5.5': ['gpt-4o-mini'],
};

export function getLegacyFallbacksForModel(modelId: string): string[] {
  const exact = UNAVAILABLE_MODEL_LEGACY_FALLBACKS[modelId];
  if (exact) return exact;
  if (modelId.startsWith('gpt-5.6-')) return ['gpt-4o-mini'];
  if (modelId.startsWith('gpt-5.5')) return ['gpt-4o-mini'];
  return [];
}

/** Fallback model order when a provider is rate-limited or unavailable. */
export function buildLlmFallbackChain(primaryModel: string): string[] {
  const primaryProvider = resolveModelProvider(primaryModel);
  const legacy = getLegacyFallbacksForModel(primaryModel);
  // Sol / complex models: mid-tier first (legacy), then economy. Others keep economy→auto.
  const chain =
    primaryProvider === 'deepseek'
      ? [DEFAULT_AUTO_MODEL]
      : primaryModel === 'gpt-5.6-sol' || /sol/i.test(primaryModel)
        ? [...legacy, DEFAULT_ECONOMY_MODEL]
        : [DEFAULT_ECONOMY_MODEL, DEFAULT_AUTO_MODEL, ...legacy];

  const seen = new Set<string>([primaryModel]);
  const result: string[] = [];

  for (const model of chain) {
    const normalized =
      model === DEFAULT_ECONOMY_MODEL && primaryProvider === 'deepseek'
        ? DEFAULT_AUTO_MODEL
        : model;
    if (!seen.has(normalized)) {
      seen.add(normalized);
      result.push(normalized);
    }
  }

  return result;
}
