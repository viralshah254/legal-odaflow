import { AI_TASK_TYPES, type AiTaskType } from './task-types';

/**
 * AI credit costs — Production Spec §15.3 / Model Router Spec §5.5
 *
 * India-specific task costs sit within the existing Umbrella credit model.
 * No new plans or tiers are created; these just map to the same wallet/credit rules.
 */

/**
 * Complexity-banded draft credit floors.
 *
 * These are the MINIMUM credits charged for a full AI draft — actual charge is
 * max(floor, token-based-actual) via recordTokenUsage.
 *
 * Derived from real API pricing (model-costs.config.ts) + prompt-cache savings:
 *
 *   SIMPLE_FORM:
 *     Model:   GPT-5.4-mini single pass
 *     Tokens:  ~1.5–2.9K input, ~1.0–2.0K output
 *     Cost:    $0.003–0.005 per draft
 *     Floor:   ceil($0.005 / $0.01) + 2 = 5 credits
 *
 *   STANDARD_DRAFT:
 *     Model:   GPT Sol/Terra × 2 passes (structure + enrich)
 *     Tokens:  ~5.8–10.5K input/pass, ~3.0–3.5K output/pass
 *     Cost:    ~$0.08–0.12 per draft (env: AI_LEGAL_COMPLEX_MODEL / AI_MID_MODEL)
 *     Floor:   40 credits
 *
 *   COMPLEX_LITIGATION:
 *     Model:   GPT Sol pass 1 (grounds) + Terra pass 2 (enrich); deep-research ReAct when needed
 *     Tokens:  ~9–17K input/pass, ~4–6K output/pass
 *     Cost:    ~$0.15–0.25
 *     Floor:   80 credits
 *
 * The 40% blended margin is enforced at the subscription level via grant sizing
 * (users receive credits = 60% of plan revenue / $0.01). These floors ensure
 * individual calls are never below raw provider cost.
 *
 * Frontend mirrors these in draft-credit-costs.ts.
 */
export const DRAFT_CREDIT_FLOORS = {
  SIMPLE_FORM: 8,          // form-fill, notices, simple agreements — GPT-mini (~$0.003–0.005)
  STANDARD_DRAFT: 40,      // most pleadings/contracts — GPT Sol/Terra × 2 passes
  COMPLEX_LITIGATION: 80,  // bail/writ/appeal — GPT Sol + Terra enrich
} as const;

export type DraftCreditBand = keyof typeof DRAFT_CREDIT_FLOORS;

/**
 * Get the credit floor for a given complexity band.
 * Used by IndiaDraftService and DraftEngineV2Service when recording token usage.
 */
export function getDraftCreditFloor(band: DraftCreditBand): number {
  return DRAFT_CREDIT_FLOORS[band];
}

/** @deprecated Use DRAFT_CREDIT_FLOORS.COMPLEX_LITIGATION for new drafts */
export const FULL_AI_DRAFT_MIN_CREDITS = 45;

export const AI_CREDIT_COSTS: Record<AiTaskType, number> = {
  [AI_TASK_TYPES.ISSUE_CHECKER]: 1,
  [AI_TASK_TYPES.CONSUMER_ISSUE_TRIAGE]: 2,
  [AI_TASK_TYPES.CONSUMER_FULL_REPORT]: 30,
  [AI_TASK_TYPES.CONSUMER_REPORT_SECTION]: 2,
  [AI_TASK_TYPES.DOCUMENT_EXPLAINER]: 25,
  [AI_TASK_TYPES.LAWYER_MATTER_QA]: 3,
  // Floor = 1 so actual token-based usage (providerCost × 40% markup) always dominates.
  // Multi-call research can still reach 50–100+ when the model actually costs that much.
  [AI_TASK_TYPES.LEGAL_RESEARCH]: 1,
  [AI_TASK_TYPES.STRATEGY_MEMO]: 60,
  // Draft tasks: floor is now STANDARD_DRAFT by default; services override with
  // getDraftCreditFloor(band) based on complexity classification.
  [AI_TASK_TYPES.DOCUMENT_DRAFT]: DRAFT_CREDIT_FLOORS.STANDARD_DRAFT,
  [AI_TASK_TYPES.MATTER_SUMMARY]: 5,
  [AI_TASK_TYPES.OPPONENT_ANALYZER]: 60,
  [AI_TASK_TYPES.OPPONENT_FILING_ANALYSIS]: 60,
  [AI_TASK_TYPES.EVIDENCE_GAP]: 40,
  [AI_TASK_TYPES.DEADLINE_AGENT]: 5,
  [AI_TASK_TYPES.BILLING_RECOVERY]: 10,
  [AI_TASK_TYPES.DOCUMENT_CLASSIFICATION]: 1,
  [AI_TASK_TYPES.CITATION_CHECK]: 15,
  [AI_TASK_TYPES.DOCUMENT_SUMMARY]: 5,
  [AI_TASK_TYPES.MATTER_KICKOFF]: 5,
  [AI_TASK_TYPES.CASE_OUTCOME_ANALYSIS]: 80,
  [AI_TASK_TYPES.TEMPLATE_DRAFT]: DRAFT_CREDIT_FLOORS.STANDARD_DRAFT,
  [AI_TASK_TYPES.DOCUMENT_REVIEW]: 40,
  // India-specific — existing plan and wallet rules apply, no repackaging
  [AI_TASK_TYPES.INDIA_SECTION_LOOKUP]: 1,
  [AI_TASK_TYPES.INDIA_FIR_EXTRACTION]: 10,
  // INDIA_COURT_DRAFT default = STANDARD_DRAFT; services use getDraftCreditFloor(band)
  [AI_TASK_TYPES.INDIA_COURT_DRAFT]: DRAFT_CREDIT_FLOORS.STANDARD_DRAFT,
  [AI_TASK_TYPES.DRAFT_CONTINUATION]: 25,
  [AI_TASK_TYPES.VOICE_TRANSCRIPTION]: 1,
  [AI_TASK_TYPES.DRAFT_INTENT_SEARCH]: 5,
  [AI_TASK_TYPES.DRAFT_FILL_BLANKS]: 5,
  [AI_TASK_TYPES.DRAFT_SELECTION_EDIT]: 1,
  // Verification fixes are billed from actual provider cost at 20% markup.
  [AI_TASK_TYPES.DRAFT_VERIFICATION_FIX]: 1,
  // Bulk AI edit on an uploaded document; floor = 2 (min visible cost for users)
  [AI_TASK_TYPES.DRAFT_BULK_EDIT]: 2,
  [AI_TASK_TYPES.DRAFT_EXTRACT_FIELDS]: 15,
  [AI_TASK_TYPES.FIRM_INTAKE_PREVIEW]: 40,
  // Meetings — minimum floor only; actual credits are computed from real usage
  [AI_TASK_TYPES.MEETING_TRANSCRIPTION]: 3,
  [AI_TASK_TYPES.MEETING_NOTES]: 2,
  [AI_TASK_TYPES.MEETING_LIVE_TRANSCRIPTION]: 1,
  // Personal drafting style analysis — premium one-time feature
  [AI_TASK_TYPES.STYLE_ANALYSIS]: 500,
  // Case-law enrichment — token-based at 20% markup; floor = 1 to let actual cost dominate
  [AI_TASK_TYPES.DRAFT_CASE_LAW_ENRICH]: 1,
  [AI_TASK_TYPES.RESEARCH_CASE_LAW_ENRICH]: 1,
  [AI_TASK_TYPES.RESEARCH_SECTION_ENRICH]: 1,
  [AI_TASK_TYPES.RESEARCH_ENRICH_BOTH]: 1,
};

export type AiCreditTaskType = AiTaskType;

export function getCreditCost(taskType: string): number {
  return AI_CREDIT_COSTS[taskType as AiTaskType] ?? 1;
}

/** Tasks that should show pre-run confirmation in UI */
export const HEAVY_CREDIT_TASKS = new Set<string>([
  AI_TASK_TYPES.CONSUMER_FULL_REPORT,
  AI_TASK_TYPES.LEGAL_RESEARCH,
  AI_TASK_TYPES.STRATEGY_MEMO,
  AI_TASK_TYPES.OPPONENT_ANALYZER,
  AI_TASK_TYPES.OPPONENT_FILING_ANALYSIS,
  AI_TASK_TYPES.EVIDENCE_GAP,
  AI_TASK_TYPES.DOCUMENT_EXPLAINER,
  AI_TASK_TYPES.CASE_OUTCOME_ANALYSIS,
  AI_TASK_TYPES.STYLE_ANALYSIS,
]);

export function requiresCreditConfirmation(taskType: string): boolean {
  return HEAVY_CREDIT_TASKS.has(taskType) || getCreditCost(taskType) >= 15;
}
