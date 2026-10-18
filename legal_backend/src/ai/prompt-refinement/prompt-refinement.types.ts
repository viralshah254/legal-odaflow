export type PromptRefinementPurpose = 'research' | 'drafting';

export type PromptRefinementSkipReason =
  | 'too_short'
  | 'too_long'
  | 'already_clear'
  | 'disabled'
  | 'llm_failed';

export interface PromptRefinementHints {
  jurisdiction?: string;
  documentKind?: string;
  parties?: string[];
  statutes?: string[];
}

export interface RefinePromptInput {
  prompt: string;
  purpose: PromptRefinementPurpose;
  countryCode?: string;
  jurisdiction?: string;
  practiceArea?: string;
  outputLanguage?: string;
  knowledgeSources?: string[];
}

export interface RefinePromptResult {
  originalPrompt: string;
  refinedPrompt: string;
  skipped: boolean;
  skipReason?: PromptRefinementSkipReason;
  hints?: PromptRefinementHints;
}

interface LlmRefinementPayload {
  refinedPrompt?: string;
  hints?: PromptRefinementHints;
}

export type { LlmRefinementPayload };
