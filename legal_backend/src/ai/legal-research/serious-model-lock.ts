import { DRAFT_PREMIUM_MODEL } from '@/ai/model-costs.config';

/** Top-tier model for serious research synthesis and non-express drafting. */
export const SERIOUS_LEGAL_MODEL = 'gpt-5.6-sol';

/** Lower model for Section Finder miss suggestions (never Sol). */
export const SECTION_FINDER_FALLBACK_MODEL = 'gpt-5.6-luna';

export function resolveSeriousSynthesisModel(configured?: string | null): string {
  const trimmed = (configured ?? '').trim();
  if (!trimmed) return SERIOUS_LEGAL_MODEL;
  // Never allow economy/mini aliases on serious paths.
  if (/mini|deepseek|nano|luna/i.test(trimmed) && !/sol/i.test(trimmed)) {
    return SERIOUS_LEGAL_MODEL;
  }
  return trimmed;
}

export function isSeriousDraftPath(input: {
  expressMode?: boolean;
  complexity?: 'simple' | 'standard' | 'complex';
  modelMode?: string;
}): boolean {
  if (input.expressMode) return false;
  if (input.modelMode === 'PREMIUM') return true;
  return input.complexity === 'standard' || input.complexity === 'complex';
}

export function resolveSeriousDraftModel(input: {
  expressMode?: boolean;
  complexity?: 'simple' | 'standard' | 'complex';
  modelMode?: string;
  economyModel: string;
  enrichModel: string;
}): string {
  if (input.expressMode) return input.enrichModel;
  if (isSeriousDraftPath(input)) return DRAFT_PREMIUM_MODEL;
  return input.economyModel;
}
