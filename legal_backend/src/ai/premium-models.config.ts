import {
  DEFAULT_AUTO_MODEL,
  DEFAULT_PREMIUM_MODEL_IDS,
  DRAFT_PREMIUM_MODEL,
  MODEL_COSTS,
  getModelCostSync,
  normalizeModelId,
  OPENAI_MODEL_COSTS,
  TYPICAL_COPILOT_INPUT_TOKENS,
  TYPICAL_COPILOT_OUTPUT_TOKENS,
} from '@/ai/model-costs.config';
import {
  computeCreditsFromProviderCost,
  estimateTokenCostUsd,
} from '@/ai-credits/credit-pricing.util';

export type AiModelMode = 'AUTO' | 'PREMIUM';

/** Visual weight tier shown in the UI instead of a raw per-message credit count. */
export type AiModelCostTier = 'fast' | 'standard' | 'heavy' | 'ultra';

/** Default Premium picker selection (Sol). */
export const DEFAULT_PREMIUM_MODEL_ID = DRAFT_PREMIUM_MODEL;

export interface PremiumModelOption {
  modelId: string;
  label: string;
  /** @deprecated Use estimatedCreditsTypical — kept for backwards-compatible API responses */
  creditMultiplier?: number;
  inputPer1M: number;
  outputPer1M: number;
  /** Typical Copilot message cost at current margin settings */
  estimatedCreditsTypical: number;
  /**
   * Human-readable cost tier derived from estimatedCreditsTypical.
   * Used by UI to show Fast / Standard / Heavy / Ultra instead of raw credit counts.
   *   fast     → ≤ 1 credit   (gpt-5.4-mini, gpt-5.4-nano)
   *   standard → 2 credits    (gpt-5.6-luna)
   *   heavy    → 3–6 credits  (gpt-5.6-terra)
   *   ultra    → ≥ 7 credits  (gpt-5.6-sol)
   */
  costTier: AiModelCostTier;
}

function deriveCostTier(estimatedCreditsTypical: number): AiModelCostTier {
  if (estimatedCreditsTypical <= 1) return 'fast';
  if (estimatedCreditsTypical <= 2) return 'standard';
  if (estimatedCreditsTypical <= 6) return 'heavy';
  return 'ultra';
}

function buildPremiumOption(
  modelId: string,
  creditUsdValue: number,
  netMarginPercent: number,
): PremiumModelOption {
  const costs = getModelCostSync(modelId);
  const providerCost = estimateTokenCostUsd(
    costs.inputPer1M,
    costs.outputPer1M,
    TYPICAL_COPILOT_INPUT_TOKENS,
    TYPICAL_COPILOT_OUTPUT_TOKENS,
  );
  const estimatedCreditsTypical = computeCreditsFromProviderCost(
    providerCost,
    creditUsdValue,
    netMarginPercent,
  );
  return {
    modelId,
    label: costs.label,
    inputPer1M: costs.inputPer1M,
    outputPer1M: costs.outputPer1M,
    estimatedCreditsTypical,
    creditMultiplier: estimatedCreditsTypical,
    costTier: deriveCostTier(estimatedCreditsTypical),
  };
}

export function listPremiumModels(
  envValue?: string,
  pricing?: { creditUsdValue?: number; netMarginPercent?: number },
): PremiumModelOption[] {
  const raw =
    envValue?.trim() ||
    process.env.AI_PREMIUM_MODELS ||
    DEFAULT_PREMIUM_MODEL_IDS.join(',');
  const creditUsdValue = pricing?.creditUsdValue ?? 0.06;
  const netMarginPercent = pricing?.netMarginPercent ?? 30;

  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const part of raw.split(',')) {
    const trimmed = part.trim();
    if (!trimmed || trimmed.startsWith('gemini') || trimmed.includes('google')) continue;
    const id = normalizeModelId(trimmed);
    if (seen.has(id) || !(id in MODEL_COSTS)) continue;
    seen.add(id);
    ordered.push(id);
  }

  const ids = ordered.length > 0 ? ordered : [...DEFAULT_PREMIUM_MODEL_IDS];
  return ids.map((id) => buildPremiumOption(id, creditUsdValue, netMarginPercent));
}

export function getPremiumModel(
  modelId: string,
  envValue?: string,
  pricing?: { creditUsdValue?: number; netMarginPercent?: number },
): PremiumModelOption | undefined {
  const normalized = normalizeModelId(modelId);
  return listPremiumModels(envValue, pricing).find((m) => m.modelId === normalized);
}

export function getAutoModelName(configService: { get: (key: string, def?: string) => string }) {
  return (
    configService.get('AI_CHEAP_MODEL', '') ||
    configService.get('AI_FAST_MODEL', DEFAULT_AUTO_MODEL)
  );
}

export function listAllOpenAiModels(): string[] {
  return Object.keys(OPENAI_MODEL_COSTS);
}

export function listAllAiModels(): string[] {
  return Object.keys(OPENAI_MODEL_COSTS);
}
