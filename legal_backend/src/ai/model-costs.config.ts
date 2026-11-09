/** Supported LLM providers for chat/completion. */
export type AiLlmProvider = 'openai' | 'deepseek' | 'google';

export const ALLOWED_AI_PROVIDERS: AiLlmProvider[] = ['openai', 'deepseek', 'google'];

export interface ModelCostRates {
  provider: AiLlmProvider;
  inputPer1M: number;
  outputPer1M: number;
  tier: 'cheap' | 'mid' | 'premium' | 'reasoning';
  label: string;
}

/** Unified model registry — OpenAI + DeepSeek. */
export const MODEL_COSTS: Record<string, ModelCostRates> = {
  // DeepSeek — economy tier (OpenAI-compatible API)
  'deepseek-chat': {
    provider: 'deepseek',
    inputPer1M: 0.27,
    outputPer1M: 1.10,
    tier: 'cheap',
    label: 'DeepSeek Chat V3',
  },
  'deepseek-reasoner': {
    provider: 'deepseek',
    inputPer1M: 0.55,
    outputPer1M: 2.19,
    tier: 'cheap',
    label: 'DeepSeek R1 Reasoner',
  },
  // OpenAI — GPT-5.6 hierarchy (Sol / Terra / Luna)
  'gpt-5.6-sol': {
    provider: 'openai',
    inputPer1M: 10.0,
    outputPer1M: 60.0,
    tier: 'reasoning',
    label: 'GPT-5.6 Sol',
  },
  'gpt-5.6-terra': {
    provider: 'openai',
    inputPer1M: 5.0,
    outputPer1M: 30.0,
    tier: 'premium',
    label: 'GPT-5.6 Terra',
  },
  'gpt-5.6-luna': {
    provider: 'openai',
    inputPer1M: 1.0,
    outputPer1M: 4.0,
    tier: 'mid',
    label: 'GPT-5.6 Luna',
  },
  // OpenAI — auto / cheap (current)
  'gpt-5.4-mini': {
    provider: 'openai',
    inputPer1M: 0.4,
    outputPer1M: 1.6,
    tier: 'cheap',
    label: 'GPT-5.4 mini',
  },
  'gpt-5.4-nano': {
    provider: 'openai',
    inputPer1M: 0.1,
    outputPer1M: 0.4,
    tier: 'cheap',
    label: 'GPT-5.4 nano',
  },
  'gpt-4.1-mini': {
    provider: 'openai',
    inputPer1M: 0.4,
    outputPer1M: 1.6,
    tier: 'cheap',
    label: 'GPT-4.1 mini (legacy)',
  },
  'gemini-2.5-flash': {
    provider: 'google',
    inputPer1M: 0.30,
    outputPer1M: 2.50,
    tier: 'mid',
    label: 'Gemini 2.5 Flash',
  },
  'gemini-2.5-pro': {
    provider: 'google',
    inputPer1M: 1.25,
    outputPer1M: 10.0,
    tier: 'premium',
    label: 'Gemini 2.5 Pro',
  },
  // Standard Developer API rates, checked 2026-11-09 against
  // https://ai.google.dev/gemini-api/docs/pricing . Date/long-context variants
  // are resolved by getModelCostForUsage, never by an unpriced model fallback.
  'gemini-3.8-flash': {
    provider: 'google', inputPer1M: 0.75, outputPer1M: 3.75,
    tier: 'mid', label: 'Gemini 3.8 Flash',
  },
  'gemini-3.1-pro-preview': {
    provider: 'google', inputPer1M: 2, outputPer1M: 12,
    tier: 'premium', label: 'Gemini 3.1 Pro Preview',
  },
  'gpt-4o-mini': {
    provider: 'openai',
    inputPer1M: 0.15,
    outputPer1M: 0.6,
    tier: 'cheap',
    label: 'GPT-4o mini (legacy)',
  },
  // OpenAI — reasoning / flagship (legacy 5.5)
  'gpt-5.5': {
    provider: 'openai',
    inputPer1M: 5.0,
    outputPer1M: 30.0,
    tier: 'reasoning',
    label: 'GPT-5.5 (legacy → prefer gpt-5.6-terra)',
  },
  'gpt-5.5-pro': {
    provider: 'openai',
    inputPer1M: 30.0,
    outputPer1M: 180.0,
    tier: 'premium',
    label: 'GPT-5.5 Pro (legacy → prefer gpt-5.6-sol)',
  },
  // OpenAI — legacy premium / reasoning
  'gpt-4.1': {
    provider: 'openai',
    inputPer1M: 3.0,
    outputPer1M: 12.0,
    tier: 'premium',
    label: 'GPT-4.1 (legacy)',
  },
  'gpt-4o': {
    provider: 'openai',
    inputPer1M: 2.5,
    outputPer1M: 10.0,
    tier: 'premium',
    label: 'GPT-4o (legacy)',
  },
  'o3-mini': {
    provider: 'openai',
    inputPer1M: 1.1,
    outputPer1M: 4.4,
    tier: 'reasoning',
    label: 'o3-mini (legacy)',
  },
  'o4-mini': {
    provider: 'openai',
    inputPer1M: 1.1,
    outputPer1M: 4.4,
    tier: 'reasoning',
    label: 'o4-mini (legacy)',
  },
};

/** @deprecated Use MODEL_COSTS */
export const OPENAI_MODEL_COSTS = MODEL_COSTS;

/** Bulk fill / cheap mechanical sections (AI_LEGAL_BULK_MODEL / AI_CHEAP_MODEL). */
export const DEFAULT_AUTO_MODEL = 'gpt-5.4-mini';

/** Structured intake / classification extraction (AI_LEGAL_EXTRACT_MODEL). */
export const DEFAULT_EXTRACT_MODEL = 'gpt-5.4-nano';

/** ReAct / fast orchestration (AI_LEGAL_ORCHESTRATOR_MODEL / AI_FAST_MODEL). */
export const DEFAULT_ORCHESTRATOR_MODEL = 'gpt-5.6-luna';

/**
 * Economy-tier model: used for simple drafts, fill-blanks, edit-selection,
 * and cheap sections in V2. DeepSeek is 5-10× cheaper than GPT-mini for
 * equivalent tasks and uses an OpenAI-compatible API.
 * Falls back to DEFAULT_AUTO_MODEL when DEEPSEEK_API_KEY is not set.
 */
export const DEFAULT_ECONOMY_MODEL = 'deepseek-chat';

/** Premium / escalated drafting + independent Sol review (Pass 1 structure, grounds). */
export const DRAFT_PREMIUM_MODEL = 'gpt-5.6-sol';

/** Default substantive drafting / enrichment model (Terra). */
export const DRAFT_ENRICH_MODEL = 'gpt-5.6-terra';

export const DEFAULT_PREMIUM_MODEL_IDS = [
  'gpt-5.6-sol',
  'gpt-5.6-terra',
  'gpt-5.6-luna',
] as const;

/** Map deprecated stored model IDs to current registry entries. */
export const LEGACY_MODEL_ID_ALIASES: Record<string, string> = {
  'gpt-4.1-mini': 'gpt-5.4-mini',
  'gpt-4o-mini': 'gpt-5.4-mini',
  'gpt-4.1': 'gpt-5.6-terra',
  'gpt-4o': 'gpt-5.6-terra',
  'o3-mini': 'gpt-5.6-terra',
  'o4-mini': 'gpt-5.6-terra',
  'gpt-5.5': 'gpt-5.6-terra',
  'gpt-5.5-pro': 'gpt-5.6-sol',
  'claude-haiku-4-5': 'gpt-5.4-mini',
  'claude-sonnet-4-6': 'gpt-5.6-luna',
  'claude-opus-4-8': 'gpt-5.6-sol',
  'claude-opus-4-6': 'gpt-5.6-sol',
  'claude-fable-5': 'gpt-5.6-sol',
};

export function normalizeModelId(modelId: string | null | undefined): string {
  if (!modelId) return DEFAULT_PREMIUM_MODEL_IDS[0];
  return LEGACY_MODEL_ID_ALIASES[modelId] ?? modelId;
}

export function resolveModelProvider(modelName: string): AiLlmProvider {
  const normalized = normalizeModelId(modelName);
  const known = MODEL_COSTS[normalized]?.provider;
  if (known) return known;
  if (normalized.startsWith('deepseek-')) return 'deepseek';
  if (normalized.startsWith('gemini-')) return 'google';
  if (normalized.startsWith('gpt-') || normalized.startsWith('o1') || normalized.startsWith('o3')) {
    return 'openai';
  }
  throw new Error(`Unknown model id: ${normalized}`);
}

/** Legacy fallback when callers cannot throw (prefer resolveModelProvider). */
export function resolveModelProviderOrDefault(modelName: string): AiLlmProvider {
  try {
    return resolveModelProvider(modelName);
  } catch {
    return 'openai';
  }
}

export function isAllowedAiProvider(value: string): value is AiLlmProvider {
  return ALLOWED_AI_PROVIDERS.includes(value as AiLlmProvider);
}

export function getModelCostSync(modelName: string): ModelCostRates {
  const normalized = normalizeModelId(modelName);
  return (
    MODEL_COSTS[normalized] ?? {
      provider: resolveModelProviderOrDefault(normalized),
      inputPer1M: 0.4,
      outputPer1M: 1.6,
      tier: 'cheap',
      label: normalized,
    }
  );
}

export type ModelTier = ModelCostRates['tier'];

/** Standard text usage rates. Provider-specific discounts, cached tokens,
 * grounding and storage remain separate receipt components. */
export function getModelCostForUsage(modelName: string, inputTokens: number, at = new Date()): ModelCostRates {
  const rates = getModelCostSync(modelName);
  if (normalizeModelId(modelName) === 'gemini-3.8-flash' && at >= new Date('2027-01-01T00:00:00Z')) {
    return { ...rates, inputPer1M: 1.5, outputPer1M: 7.5 };
  }
  if (normalizeModelId(modelName) === 'gemini-3.1-pro-preview' && inputTokens > 200_000) {
    return { ...rates, inputPer1M: 4, outputPer1M: 18 };
  }
  return rates;
}

/**
 * Capability ordering for the tiers. "reasoning" and "premium" are both
 * acceptable for work that must not silently degrade; "cheap" never is.
 */
const TIER_RANK: Record<ModelTier, number> = {
  cheap: 0,
  mid: 1,
  premium: 2,
  reasoning: 2,
};

export function getModelTier(modelName: string): ModelTier {
  return getModelCostSync(modelName).tier;
}

/** True when `modelName` is at least as capable as `floor`. */
export function meetsModelFloor(modelName: string, floor: ModelTier): boolean {
  return TIER_RANK[getModelTier(modelName)] >= TIER_RANK[floor];
}

export function listModelsForProvider(provider: AiLlmProvider): string[] {
  return Object.entries(MODEL_COSTS)
    .filter(([, rates]) => rates.provider === provider)
    .map(([id]) => id);
}

/** Typical Copilot chat turn — used for estimates in UI. */
export const TYPICAL_COPILOT_INPUT_TOKENS = 2_500;
export const TYPICAL_COPILOT_OUTPUT_TOKENS = 800;
