export type AiModelMode = 'AUTO' | 'PREMIUM';

export interface PremiumModelOption {
  modelId: string;
  label: string;
  creditMultiplier: number;
}

const DEFAULT_PREMIUM_MODELS: PremiumModelOption[] = [
  { modelId: 'gpt-4.1', label: 'GPT-4.1', creditMultiplier: 3 },
  { modelId: 'o3-mini', label: 'o3-mini', creditMultiplier: 4 },
];

export function listPremiumModels(envValue?: string): PremiumModelOption[] {
  const ids =
    envValue?.trim() ||
    process.env.AI_PREMIUM_MODELS ||
    'gpt-4.1,o3-mini';
  const allowed = new Set(
    ids
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean),
  );
  return DEFAULT_PREMIUM_MODELS.filter((m) => allowed.has(m.modelId));
}

export function getPremiumModel(
  modelId: string,
  envValue?: string,
): PremiumModelOption | undefined {
  return listPremiumModels(envValue).find((m) => m.modelId === modelId);
}

export function getAutoModelName(configService: { get: (key: string, def?: string) => string }) {
  return (
    configService.get('AI_CHEAP_MODEL', '') ||
    configService.get('AI_FAST_MODEL', 'gpt-4.1-mini')
  );
}
