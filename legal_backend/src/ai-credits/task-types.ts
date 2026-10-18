/**
 * Unified AI task types — shared by gateway, credit costs, copilot, and model router.
 */
export const AI_TASK_TYPES = {
  ISSUE_CHECKER: 'ISSUE_CHECKER',
  CONSUMER_FULL_REPORT: 'CONSUMER_FULL_REPORT',
  CONSUMER_REPORT_SECTION: 'CONSUMER_REPORT_SECTION',
  CONSUMER_ISSUE_TRIAGE: 'CONSUMER_ISSUE_TRIAGE',
  DOCUMENT_EXPLAINER: 'DOCUMENT_EXPLAINER',
  LAWYER_MATTER_QA: 'LAWYER_MATTER_QA',
  LEGAL_RESEARCH: 'LEGAL_RESEARCH',
  STRATEGY_MEMO: 'STRATEGY_MEMO',
  DOCUMENT_DRAFT: 'DOCUMENT_DRAFT',
  MATTER_SUMMARY: 'MATTER_SUMMARY',
  OPPONENT_ANALYZER: 'OPPONENT_ANALYZER',
  OPPONENT_FILING_ANALYSIS: 'OPPONENT_FILING_ANALYSIS',
  EVIDENCE_GAP: 'EVIDENCE_GAP',
  DEADLINE_AGENT: 'DEADLINE_AGENT',
  BILLING_RECOVERY: 'BILLING_RECOVERY',
  DOCUMENT_CLASSIFICATION: 'DOCUMENT_CLASSIFICATION',
  CITATION_CHECK: 'CITATION_CHECK',
  DOCUMENT_SUMMARY: 'DOCUMENT_SUMMARY',
  MATTER_KICKOFF: 'MATTER_KICKOFF',
  CASE_OUTCOME_ANALYSIS: 'CASE_OUTCOME_ANALYSIS',
  TEMPLATE_DRAFT: 'TEMPLATE_DRAFT',
  DOCUMENT_REVIEW: 'DOCUMENT_REVIEW',
  // ── India-specific workflows (under the existing Umbrella pricing/credit model) ──
  // Section Finder is free (legal-reference data, not AI generation).
  INDIA_SECTION_LOOKUP: 'INDIA_SECTION_LOOKUP',
  // FIR extraction uses an LLM; billed like a focused document analysis.
  INDIA_FIR_EXTRACTION: 'INDIA_FIR_EXTRACTION',
  // India court drafting reuses TEMPLATE_DRAFT credit costs.
  INDIA_COURT_DRAFT: 'INDIA_COURT_DRAFT',
  // Each continuation pass when a draft is truncated at token limit.
  DRAFT_CONTINUATION: 'DRAFT_CONTINUATION',
  // Voice transcription (Whisper) is billed at a low cost per submission.
  VOICE_TRANSCRIPTION: 'VOICE_TRANSCRIPTION',
  // Document drafting studio — Find & Draft intent search (vector + lexical).
  DRAFT_INTENT_SEARCH: 'DRAFT_INTENT_SEARCH',
  // Minor drafting edits (fill blanks, selection revise, bulk edit).
  DRAFT_FILL_BLANKS: 'DRAFT_FILL_BLANKS',
  DRAFT_SELECTION_EDIT: 'DRAFT_SELECTION_EDIT',
  // Post-draft verification fixes (retrieve/qualify/check law/fill paths).
  DRAFT_VERIFICATION_FIX: 'DRAFT_VERIFICATION_FIX',
  // Bulk AI edit on an uploaded document (whole-document instruction).
  DRAFT_BULK_EDIT: 'DRAFT_BULK_EDIT',
  // Field extraction from intake text in the template wizard.
  DRAFT_EXTRACT_FIELDS: 'DRAFT_EXTRACT_FIELDS',
  // Firm intake full-analysis preview (4-step: classify → search → strategy → draft).
  FIRM_INTAKE_PREVIEW: 'FIRM_INTAKE_PREVIEW',
  // Meetings — token/duration-based billing (actual cost × 1.4 margin).
  // MEETING_TRANSCRIPTION is charged per audio-minute (Whisper-1 rate).
  MEETING_TRANSCRIPTION: 'MEETING_TRANSCRIPTION',
  // MEETING_NOTES is charged per LLM token (gpt-4o-mini or equivalent).
  MEETING_NOTES: 'MEETING_NOTES',
  // MEETING_LIVE_TRANSCRIPTION is charged per second of Deepgram streaming STT.
  // Deepgram Nova-3 Pay-As-You-Go: ~$0.0077/min billed per second.
  // At 40% margin: ~2 credits/min. Floor = 1 credit.
  MEETING_LIVE_TRANSCRIPTION: 'MEETING_LIVE_TRANSCRIPTION',
  // Personal drafting style analysis — one-time LLM extraction of style profile from uploaded samples.
  STYLE_ANALYSIS: 'STYLE_ANALYSIS',
  // Case-law enrichment — retrieve + match verified case laws for an existing draft.
  // Charged at 20% markup on actual provider cost (no fixed floor domination).
  DRAFT_CASE_LAW_ENRICH: 'DRAFT_CASE_LAW_ENRICH',
  // Research memo enrichment — case laws, sections, or both (20% markup).
  RESEARCH_CASE_LAW_ENRICH: 'RESEARCH_CASE_LAW_ENRICH',
  RESEARCH_SECTION_ENRICH: 'RESEARCH_SECTION_ENRICH',
  RESEARCH_ENRICH_BOTH: 'RESEARCH_ENRICH_BOTH',
} as const;

export type AiTaskType = (typeof AI_TASK_TYPES)[keyof typeof AI_TASK_TYPES];

export const COPILOT_TOOL_TASK_MAP: Record<string, AiTaskType> = {
  summarize_matter: AI_TASK_TYPES.MATTER_SUMMARY,
  legal_research_memo: AI_TASK_TYPES.LEGAL_RESEARCH,
  draft_document: AI_TASK_TYPES.DOCUMENT_DRAFT,
  suggest_next_steps: AI_TASK_TYPES.LAWYER_MATTER_QA,
};
