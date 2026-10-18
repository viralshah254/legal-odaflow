/**
 * Frontend mirror of backend AI_CREDIT_COSTS for feature-level credit gates.
 * Keep in sync with legal_backend/src/ai-credits/credit-costs.ts.
 */
export const FEATURE_CREDIT_COSTS = {
  /** Questions/clarification generation step (CONSUMER_ISSUE_TRIAGE) */
  INTAKE_QUESTIONS: 2,
  /** Full 4-step intake analysis preview (FIRM_INTAKE_PREVIEW) */
  INTAKE_PREVIEW: 25,
  /** Document review analysis (DOCUMENT_REVIEW) */
  DOCUMENT_REVIEW: 25,
  /** Legal research run (LEGAL_RESEARCH) */
  LEGAL_RESEARCH: 30,
  /** Research enrich actions (token-based; UI estimate floor) */
  RESEARCH_ENRICH: 2,
  /** India section / statute lookup (INDIA_SECTION_LOOKUP) */
  SECTION_LOOKUP: 1,
  /** Matter AI quick actions (draft update, suggest tasks, billing narrative) */
  MATTER_AI_ACTION: 5,
} as const
