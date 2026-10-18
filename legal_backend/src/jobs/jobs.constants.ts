export const QUEUE_NAMES = {
  OCR: 'ocr-processing',
  AI_HIGH: 'ai.high_priority',
  AI_FAST: 'ai.fast_priority',
  AI_LOW: 'ai.low_priority',
  NOTIFICATIONS: 'notifications.dispatch',
  AUTOMATIONS: 'automations.execute',
  ANONYMIZATION: 'anonymization.process',
  LEGAL_INGEST: 'legal.ingest',
  MIGRATION: 'migration.import',
  SEARCH_INDEX: 'search.index',
  AGENTIC_WORKFLOW: 'agentic.workflow',
  LEGAL_CRAWL: 'legal.crawl',
  OBLIGATION_CHECK: 'obligation.check',
  DRAFT_GENERATE: 'draft.generate',
  DRAFT_REPAIR: 'draft.repair',
  DRAFT_EXPORT: 'draft.export',
  DRAFT_SHADOW_EVALUATION: 'draft.shadow_evaluation',
  WHATSAPP_SEND: 'whatsapp.send',
  GOOGLE_PLACES_SCRAPE: 'lawyer-prospects.google_places',
} as const;

export const AI_JOB_TYPES = {
  OUTCOME_REFRESH: 'OUTCOME_REFRESH',
  SUMMARIZE_MATTER: 'SUMMARIZE_MATTER',
  LEGAL_RESEARCH_MEMO: 'LEGAL_RESEARCH_MEMO',
  DRAFT_DOCUMENT: 'DRAFT_DOCUMENT',
  LEAD_DRAFT_GENERATE: 'LEAD_DRAFT_GENERATE',
  SUGGEST_NEXT_STEPS: 'SUGGEST_NEXT_STEPS',
  DOCUMENT_EXPLAINER: 'DOCUMENT_EXPLAINER',
  OPPONENT_ANALYZER: 'OPPONENT_ANALYZER',
  EVIDENCE_GAP: 'EVIDENCE_GAP',
  DEADLINE_AGENT: 'DEADLINE_AGENT',
  BILLING_RECOVERY: 'BILLING_RECOVERY',
  MEETING_TRANSCRIBE: 'MEETING_TRANSCRIBE',
  MATTER_INIT: 'MATTER_INIT',
  MATTER_REFRESH: 'MATTER_REFRESH',
} as const;

export const ANONYMIZATION_JOB_TYPES = {
  PROCESS: 'ANONYMIZATION_PROCESS',
} as const;

export const LEGAL_INGEST_JOB_TYPES = {
  COURTLISTENER_SYNC: 'COURTLISTENER_SYNC',
  ESCR_SYNC: 'ESCR_SYNC',
  IK_PERSIST_SYNC: 'IK_PERSIST_SYNC',
  LICENSED_CASE_LAW_SYNC: 'LICENSED_CASE_LAW_SYNC',
  STATUTE_SECTIONS_SEED: 'STATUTE_SECTIONS_SEED',
  STATUTE_ACT_INGEST: 'STATUTE_ACT_INGEST',
  TIER1_STATUTE_SYNC: 'TIER1_STATUTE_SYNC',
  /** Kenya Law manifest rebuild (catalog scrape or Laws.Africa when configured). */
  KE_MANIFEST_DISCOVERY: 'KE_MANIFEST_DISCOVERY',
  /** Resumable batch ingest from corpus/ke/sources.manifest.json. */
  KE_MANIFEST_BATCH_INGEST: 'KE_MANIFEST_BATCH_INGEST',
  /** Kenya Law judgments feed + topical search sync. */
  KE_CASE_LAW_SYNC: 'KE_CASE_LAW_SYNC',
  /** Gazette archive discovery dispatch (ingest wired separately). */
  KE_GAZETTE_DISPATCH: 'KE_GAZETTE_DISPATCH',
  /** Bills / county / treaty / EAC / regulator discovery dispatch. */
  KE_EXTENDED_COLLECTION_DISPATCH: 'KE_EXTENDED_COLLECTION_DISPATCH',
  /** Coverage verification against manifest + tier-1 thresholds. */
  KE_VERIFY_COVERAGE: 'KE_VERIFY_COVERAGE',
  /** Force re-ingest + re-embed one manifest act. */
  KE_REEMBED_ACT: 'KE_REEMBED_ACT',
  /** Diff manifest against Kenya Law catalog and re-ingest updated expressions. */
  KE_MANIFEST_CHANGE_SYNC: 'KE_MANIFEST_CHANGE_SYNC',
} as const;

export const NOTIFICATION_JOB_TYPES = {
  DISPATCH: 'DISPATCH',
} as const;

export const AUTOMATION_JOB_TYPES = {
  EXECUTE: 'EXECUTE',
} as const;

export const MIGRATION_JOB_TYPES = {
  CLIO_IMPORT: 'CLIO_IMPORT',
} as const;

export const SEARCH_INDEX_JOB_TYPES = {
  UPSERT: 'SEARCH_INDEX_UPSERT',
  DELETE: 'SEARCH_INDEX_DELETE',
} as const;
