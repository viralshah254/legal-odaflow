import { DEEP_JURISDICTION_CODES } from '@/config/jurisdiction-engine';
import type { ResearchComplexity } from './legal-research-model-router.service';

/**
 * Analytical / doctrine mode activates when RAG cannot ground a useful memo.
 * The model may reason from general doctrine and comparative materials, but every
 * such statement must be labeled as non-verified analytical guidance — never as
 * retrieved primary authority.
 */

export type AnalyticalActivationReason =
  | 'best_effort_thin_rag'
  | 'best_effort_jurisdiction'
  | 'zero_authorities'
  | 'sufficiency_failed';

export interface AnalyticalModeDecision {
  enabled: boolean;
  reasons: AnalyticalActivationReason[];
  /** User-facing reliance label key. */
  relianceLabel: 'analytical-guidance' | 'source-grounded';
}

export interface AnalyticalModeInput {
  countryCode: string;
  authorityCount: number;
  sufficiencyPassed: boolean;
  jurisdictionTier?: 'deep' | 'best_effort';
}

export function isDeepJurisdiction(countryCode: string): boolean {
  return DEEP_JURISDICTION_CODES.includes(countryCode.toUpperCase());
}

export function resolveJurisdictionTier(
  countryCode: string,
): 'deep' | 'best_effort' {
  return isDeepJurisdiction(countryCode) ? 'deep' : 'best_effort';
}

/**
 * Decide whether synthesis should run in analytical/doctrine mode.
 * Deep jurisdictions stay citation-gated unless retrieval is empty or failed sufficiency
 * with zero usable hits.
 */
export function decideAnalyticalMode(input: AnalyticalModeInput): AnalyticalModeDecision {
  const tier =
    input.jurisdictionTier ?? resolveJurisdictionTier(input.countryCode);
  const reasons: AnalyticalActivationReason[] = [];

  if (tier === 'best_effort') {
    reasons.push('best_effort_jurisdiction');
    if (input.authorityCount < 3 || !input.sufficiencyPassed) {
      reasons.push('best_effort_thin_rag');
    }
  }

  if (input.authorityCount === 0) {
    reasons.push('zero_authorities');
  }

  if (!input.sufficiencyPassed && input.authorityCount < 3) {
    reasons.push('sufficiency_failed');
  }

  // Deep + strong retrieval: stay source-grounded.
  if (tier === 'deep' && input.sufficiencyPassed && input.authorityCount >= 3) {
    return { enabled: false, reasons: [], relianceLabel: 'source-grounded' };
  }

  // Deep + empty/failed: allow analytical fallback so the memo is still useful.
  if (tier === 'deep') {
    const deepThin =
      input.authorityCount === 0 ||
      (!input.sufficiencyPassed && input.authorityCount < 2);
    if (!deepThin) {
      return { enabled: false, reasons: [], relianceLabel: 'source-grounded' };
    }
  }

  const enabled = reasons.length > 0;
  return {
    enabled,
    reasons: enabled ? reasons : [],
    relianceLabel: enabled ? 'analytical-guidance' : 'source-grounded',
  };
}

/**
 * Non-tier-1 COMPLEX/ULTRA research should auto-escalate to DEEP + web search.
 * Construction-delay and other specialist domains on best-effort jurisdictions
 * also escalate even at STANDARD complexity — FAST is too thin for retention.
 */
export function shouldForceDeepForThinJurisdiction(input: {
  countryCode: string;
  researchMode?: 'FAST' | 'DEEP' | 'GUIDANCE';
  complexity: ResearchComplexity;
  legalDomain?: string;
}): boolean {
  if (input.researchMode === 'DEEP') return false;
  if (input.researchMode === 'FAST' || input.researchMode === 'GUIDANCE') return false;
  if (isDeepJurisdiction(input.countryCode)) return false;
  if (input.legalDomain === 'CONSTRUCTION_DELAY') return true;
  return (
    input.complexity === 'COMPLEX' ||
    input.complexity === 'ULTRA' ||
    input.complexity === 'STANDARD'
  );
}

/** Best-effort jurisdictions should never skip live web in FAST mode. */
export function shouldForceWebSearch(countryCode: string): boolean {
  return !isDeepJurisdiction(countryCode);
}

export function analyticalAgentRoundBudget(input: {
  countryCode: string;
  analyticalMode: boolean;
  configuredMax: number;
}): number {
  if (!input.analyticalMode && isDeepJurisdiction(input.countryCode)) {
    return input.configuredMax;
  }
  // Give thin jurisdictions more ReAct rounds to find comparative sources.
  return Math.max(input.configuredMax, 4);
}
