import { AI_TASK_TYPES } from '@/ai-credits/task-types';

export type ModelTier = 'cheap' | 'mid' | 'premium' | 'local_or_cheap';

export interface ModelRouteConfig {
  tier: ModelTier;
  defaultModelEnv: string;
  fallbackModelEnv?: string;
  maxInputTokens: number;
  maxOutputTokens: number;
  requiresRag: boolean;
  requiresCitationVerification: boolean;
  requiresMatterContext?: boolean;
}

export const MODEL_ROUTES: Record<string, ModelRouteConfig> = {
  [AI_TASK_TYPES.ISSUE_CHECKER]: {
    tier: 'cheap',
    defaultModelEnv: 'AI_CHEAP_MODEL',
    maxInputTokens: 4000,
    maxOutputTokens: 1200,
    requiresRag: true,
    requiresCitationVerification: false,
  },
  [AI_TASK_TYPES.CONSUMER_ISSUE_TRIAGE]: {
    tier: 'local_or_cheap',
    defaultModelEnv: 'AI_CHEAP_MODEL',
    maxInputTokens: 2000,
    maxOutputTokens: 400,
    requiresRag: false,
    requiresCitationVerification: false,
  },
  [AI_TASK_TYPES.CONSUMER_FULL_REPORT]: {
    tier: 'mid',
    defaultModelEnv: 'AI_MID_MODEL',
    fallbackModelEnv: 'AI_REASONING_MODEL',
    maxInputTokens: 16000,
    maxOutputTokens: 5000,
    requiresRag: true,
    requiresCitationVerification: true,
  },
  [AI_TASK_TYPES.LAWYER_MATTER_QA]: {
    tier: 'cheap',
    defaultModelEnv: 'AI_CHEAP_MODEL',
    maxInputTokens: 8000,
    maxOutputTokens: 2000,
    requiresRag: false,
    requiresCitationVerification: false,
  },
  [AI_TASK_TYPES.LEGAL_RESEARCH]: {
    tier: 'premium',
    defaultModelEnv: 'AI_REASONING_MODEL',
    maxInputTokens: 64000,
    maxOutputTokens: 9000,
    requiresRag: true,
    requiresCitationVerification: true,
  },
  [AI_TASK_TYPES.STRATEGY_MEMO]: {
    tier: 'premium',
    defaultModelEnv: 'AI_REASONING_MODEL',
    maxInputTokens: 64000,
    maxOutputTokens: 9000,
    requiresRag: true,
    requiresCitationVerification: true,
    requiresMatterContext: true,
  },
  [AI_TASK_TYPES.OPPONENT_ANALYZER]: {
    tier: 'premium',
    defaultModelEnv: 'AI_REASONING_MODEL',
    maxInputTokens: 32000,
    maxOutputTokens: 8000,
    requiresRag: true,
    requiresCitationVerification: true,
    requiresMatterContext: true,
  },
  [AI_TASK_TYPES.OPPONENT_FILING_ANALYSIS]: {
    tier: 'premium',
    defaultModelEnv: 'AI_REASONING_MODEL',
    maxInputTokens: 32000,
    maxOutputTokens: 8000,
    requiresRag: true,
    requiresCitationVerification: true,
    requiresMatterContext: true,
  },
  [AI_TASK_TYPES.MATTER_SUMMARY]: {
    tier: 'cheap',
    defaultModelEnv: 'AI_CHEAP_MODEL',
    maxInputTokens: 12000,
    maxOutputTokens: 2000,
    requiresRag: false,
    requiresCitationVerification: false,
    requiresMatterContext: true,
  },
  [AI_TASK_TYPES.DOCUMENT_DRAFT]: {
    tier: 'premium',
    defaultModelEnv: 'AI_REASONING_MODEL',
    maxInputTokens: 32000,
    maxOutputTokens: 6000,
    requiresRag: false,
    requiresCitationVerification: false,
    requiresMatterContext: true,
  },
  [AI_TASK_TYPES.DOCUMENT_EXPLAINER]: {
    tier: 'mid',
    defaultModelEnv: 'AI_MID_MODEL',
    maxInputTokens: 16000,
    maxOutputTokens: 4000,
    requiresRag: true,
    requiresCitationVerification: false,
  },
  [AI_TASK_TYPES.EVIDENCE_GAP]: {
    tier: 'premium',
    defaultModelEnv: 'AI_REASONING_MODEL',
    maxInputTokens: 24000,
    maxOutputTokens: 4000,
    requiresRag: false,
    requiresCitationVerification: false,
    requiresMatterContext: true,
  },
  [AI_TASK_TYPES.CASE_OUTCOME_ANALYSIS]: {
    tier: 'premium',
    defaultModelEnv: 'AI_REASONING_MODEL',
    maxInputTokens: 32000,
    maxOutputTokens: 6000,
    requiresRag: false,
    requiresCitationVerification: false,
    requiresMatterContext: true,
  },
  [AI_TASK_TYPES.DOCUMENT_CLASSIFICATION]: {
    tier: 'local_or_cheap',
    defaultModelEnv: 'AI_CHEAP_MODEL',
    fallbackModelEnv: 'AI_LOCAL_CLASSIFIER_MODEL',
    maxInputTokens: 4000,
    maxOutputTokens: 500,
    requiresRag: false,
    requiresCitationVerification: false,
  },
};

export const DEFAULT_MODEL_ROUTE: ModelRouteConfig = {
  tier: 'cheap',
  defaultModelEnv: 'AI_FAST_MODEL',
  maxInputTokens: 8000,
  maxOutputTokens: 2000,
  requiresRag: false,
  requiresCitationVerification: false,
};
