/** Env vars that configure Legal Research / drafting model routing. */
export const AI_LEGAL_MODEL_ENV_VARS = [
  { envVar: 'AI_LEGAL_FAST_MODEL', defaultModel: 'gpt-5.6-luna', role: 'fast_synthesis' },
  { envVar: 'AI_LEGAL_STANDARD_MODEL', defaultModel: 'gpt-5.6-terra', role: 'standard_synthesis' },
  { envVar: 'AI_LEGAL_COMPLEX_MODEL', defaultModel: 'gpt-5.6-sol', role: 'complex_synthesis' },
  { envVar: 'AI_LEGAL_LIGHT_VERIFIER_MODEL', defaultModel: 'gpt-5.6-terra', role: 'light_verifier' },
  { envVar: 'AI_LEGAL_HARD_VERIFIER_MODEL', defaultModel: 'gpt-5.6-sol', role: 'hard_verifier' },
  { envVar: 'AI_LEGAL_REPAIR_MODEL', defaultModel: 'gpt-5.6-terra', role: 'repair' },
  { envVar: 'AI_LEGAL_ORCHESTRATOR_MODEL', defaultModel: 'gpt-5.6-luna', role: 'orchestrator' },
  { envVar: 'AI_LEGAL_BULK_MODEL', defaultModel: 'gpt-5.4-mini', role: 'bulk' },
  { envVar: 'AI_LEGAL_EXTRACT_MODEL', defaultModel: 'gpt-5.4-nano', role: 'extract' },
] as const;
