import { meetsModelFloor, DRAFT_PREMIUM_MODEL } from '@/ai/model-costs.config';

/** Top-tier model for serious research synthesis and non-express drafting. */
export const SERIOUS_LEGAL_MODEL = 'gpt-5.6-sol';

/** Premium model for Section Finder miss suggestions. */
export const SECTION_FINDER_FALLBACK_MODEL = SERIOUS_LEGAL_MODEL;

export function resolveSeriousSynthesisModel(configured?: string | null): string {
  const trimmed = (configured ?? '').trim();
  if (!trimmed) return SERIOUS_LEGAL_MODEL;
  // Never allow economy/mini aliases on serious paths.
  if (!meetsModelFloor(trimmed, 'premium')) {
    return SERIOUS_LEGAL_MODEL;
  }
  return trimmed;
}

export function isSeriousDraftPath(input: {
  expressMode?: boolean;
  complexity?: 'simple' | 'standard' | 'complex';
  modelMode?: string;
}): boolean {
  return true;
}

export function resolveSeriousDraftModel(input: {
  expressMode?: boolean;
  complexity?: 'simple' | 'standard' | 'complex';
  modelMode?: string;
  economyModel: string;
  enrichModel: string;
}): string {
  return DRAFT_PREMIUM_MODEL;
}
