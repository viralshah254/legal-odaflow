/**
 * Unified Drafting Engine — Model Alias Registry
 *
 * GPT-5.6 hierarchy:
 *   nano/mini → Luna (orchestration) → Terra (default draft) → Sol (premium + verify)
 *
 * Independent verification rule: PREMIUM_REVIEWER / LEGAL_REVIEWER must run as a
 * separate completion from LEGAL_DRAFTER / PREMIUM_REASONER — never self-certify.
 */

export const DRAFT_MODEL_ALIASES = {
  /** Cheap extraction / intake normalization */
  INTAKE_CHEAP: 'gpt-5.4-nano',

  /** Reliable intake when nano unavailable */
  INTAKE_RELIABLE: 'gpt-5.6-luna',

  /** Outline, execution plan, section batching */
  PLANNER: 'gpt-5.6-luna',

  /** Headings, schedules, verification clauses, signature blocks */
  MECHANICAL_DRAFTER: 'gpt-5.6-luna',

  /** Default substantive drafting (facts, grounds, arguments, prayer) */
  LEGAL_DRAFTER: 'gpt-5.6-terra',

  /** First-pass independent defect report (separate completion from drafter) */
  LEGAL_REVIEWER: 'gpt-5.6-terra',

  /** Earned escalation: complexity, conflicts, court-ready, repair failures */
  PREMIUM_REASONER: 'gpt-5.6-sol',

  /** Mandatory independent Sol reviewer for premium / court-facing work */
  PREMIUM_REVIEWER: 'gpt-5.6-sol',

  /** Formatting repairs, placeholder fills */
  ROUTINE_REPAIR: 'gpt-5.6-luna',

  /** Substantive paragraph/section repair */
  SUBSTANTIVE_REPAIR: 'gpt-5.6-terra',

  /** Fast fallback across providers */
  FALLBACK_FAST: 'gpt-5.4-mini',
} as const;

export type DraftModelAlias = keyof typeof DRAFT_MODEL_ALIASES;

/** Quality tiers and their model stacks. */
export const QUALITY_TIER_MODELS = {
  express: {
    intake: DRAFT_MODEL_ALIASES.INTAKE_CHEAP,
    planner: DRAFT_MODEL_ALIASES.MECHANICAL_DRAFTER,
    substantiveDrafter: DRAFT_MODEL_ALIASES.MECHANICAL_DRAFTER,
    escalateTo: DRAFT_MODEL_ALIASES.LEGAL_DRAFTER,
    reviewer: DRAFT_MODEL_ALIASES.LEGAL_REVIEWER,
    repair: DRAFT_MODEL_ALIASES.ROUTINE_REPAIR,
  },
  standard: {
    intake: DRAFT_MODEL_ALIASES.INTAKE_CHEAP,
    planner: DRAFT_MODEL_ALIASES.PLANNER,
    substantiveDrafter: DRAFT_MODEL_ALIASES.LEGAL_DRAFTER,
    escalateTo: DRAFT_MODEL_ALIASES.PREMIUM_REASONER,
    reviewer: DRAFT_MODEL_ALIASES.LEGAL_REVIEWER,
    repair: DRAFT_MODEL_ALIASES.SUBSTANTIVE_REPAIR,
  },
  premium: {
    intake: DRAFT_MODEL_ALIASES.INTAKE_RELIABLE,
    planner: DRAFT_MODEL_ALIASES.PLANNER,
    substantiveDrafter: DRAFT_MODEL_ALIASES.LEGAL_DRAFTER,
    escalateTo: DRAFT_MODEL_ALIASES.PREMIUM_REASONER,
    reviewer: DRAFT_MODEL_ALIASES.PREMIUM_REVIEWER,
    repair: DRAFT_MODEL_ALIASES.SUBSTANTIVE_REPAIR,
  },
} as const;

export type QualityTier = keyof typeof QUALITY_TIER_MODELS;
