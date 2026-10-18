/**
 * Seed data for AICreditRate — admin-visible credit pricing by task × segment.
 * Base credits mirror the static AI_CREDIT_COSTS table so the admin sees
 * live values on first boot and can tune per-segment multipliers from there.
 */

export interface AiCreditRateSeed {
  id: string;
  taskType: string;
  userSegment: string;
  baseCredits: number;
  minCredits: number;
  maxCredits: number;
  modelTier: string;
  markupMultiplier: number;
  enabled: boolean;
}

// ─── Source-of-truth costs (mirrors AI_CREDIT_COSTS) ─────────────────────────
const TASK_DEFAULTS: Record<string, { credits: number; tier: string }> = {
  ISSUE_CHECKER:               { credits: 1,  tier: 'cheap' },
  CONSUMER_ISSUE_TRIAGE:       { credits: 2,  tier: 'local_or_cheap' },
  CONSUMER_FULL_REPORT:        { credits: 30, tier: 'mid' },
  CONSUMER_REPORT_SECTION:     { credits: 2,  tier: 'cheap' },
  DOCUMENT_EXPLAINER:          { credits: 25, tier: 'mid' },
  LAWYER_MATTER_QA:            { credits: 3,  tier: 'cheap' },
  LEGAL_RESEARCH:              { credits: 50, tier: 'premium' },
  STRATEGY_MEMO:               { credits: 60, tier: 'premium' },
  DOCUMENT_DRAFT:              { credits: 40, tier: 'premium' },
  MATTER_SUMMARY:              { credits: 5,  tier: 'cheap' },
  OPPONENT_ANALYZER:           { credits: 60, tier: 'premium' },
  OPPONENT_FILING_ANALYSIS:    { credits: 60, tier: 'premium' },
  EVIDENCE_GAP:                { credits: 40, tier: 'premium' },
  DEADLINE_AGENT:              { credits: 5,  tier: 'cheap' },
  BILLING_RECOVERY:            { credits: 10, tier: 'cheap' },
  DOCUMENT_CLASSIFICATION:     { credits: 1,  tier: 'local_or_cheap' },
  CITATION_CHECK:              { credits: 15, tier: 'cheap' },
  DOCUMENT_SUMMARY:            { credits: 5,  tier: 'cheap' },
  MATTER_KICKOFF:              { credits: 5,  tier: 'cheap' },
  CASE_OUTCOME_ANALYSIS:       { credits: 80, tier: 'premium' },
  TEMPLATE_DRAFT:              { credits: 40, tier: 'premium' },
  DOCUMENT_REVIEW:             { credits: 40, tier: 'premium' },
  INDIA_SECTION_LOOKUP:        { credits: 1,  tier: 'local_or_cheap' },
  INDIA_FIR_EXTRACTION:        { credits: 10, tier: 'mid' },
  INDIA_COURT_DRAFT:           { credits: 40, tier: 'premium' },
  VOICE_TRANSCRIPTION:         { credits: 1,  tier: 'local_or_cheap' },
  DRAFT_INTENT_SEARCH:         { credits: 5,  tier: 'cheap' },
  DRAFT_FILL_BLANKS:           { credits: 5,  tier: 'cheap' },
  DRAFT_SELECTION_EDIT:        { credits: 1,  tier: 'local_or_cheap' },
  FIRM_INTAKE_PREVIEW:         { credits: 40, tier: 'premium' },
  // Meetings — floors only; actual is billed from real Whisper/LLM usage
  MEETING_TRANSCRIPTION:         { credits: 3,  tier: 'cheap' },
  MEETING_NOTES:                 { credits: 2,  tier: 'cheap' },
  // Deepgram streaming STT — floor 1 credit; actual billed per second at session stop
  MEETING_LIVE_TRANSCRIPTION:    { credits: 1,  tier: 'cheap' },
};

// All segments apply the same 1.0 multiplier — tiered margins are enforced at
// the usage-margin level via PLAN_NET_MARGIN_PERCENT, not via per-segment seed discounts.
const USER_SEGMENTS: Array<{ segment: string; markup: number }> = [
  { segment: 'CONSUMER_FREE',  markup: 1.0 },
  { segment: 'CONSUMER_PLUS',  markup: 1.0 },
  { segment: 'LAWYER_SOLO',    markup: 1.0 },
  { segment: 'FIRM',           markup: 1.0 },
  { segment: 'ENTERPRISE',     markup: 1.0 },
];

export const AI_CREDIT_RATE_SEEDS: AiCreditRateSeed[] = USER_SEGMENTS.flatMap(
  ({ segment, markup }) =>
    Object.entries(TASK_DEFAULTS).map(([taskType, { credits, tier }]) => ({
      id: `cr-${taskType.toLowerCase().replace(/_/g, '-')}-${segment.toLowerCase().replace(/_/g, '-')}`,
      taskType,
      userSegment: segment,
      baseCredits: credits,
      minCredits: credits > 0 ? credits : 0,
      maxCredits: Math.max(credits * 10, 100),
      modelTier: tier,
      markupMultiplier: markup,
      enabled: true,
    })),
);
