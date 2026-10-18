/** Per-consumer MI rollout flags (P18). Set via env or tenant config later. */
export const MI_FEATURE_FLAGS = {
  draftIntent: process.env.MI_DRAFT_INTENT !== 'false',
  intake: process.env.MI_INTAKE !== 'false',
  copilot: process.env.MI_COPILOT !== 'false',
  legalResearch: process.env.MI_LEGAL_RESEARCH !== 'false',
  indiaDraft: process.env.MI_INDIA_DRAFT !== 'false',
  documentReview: process.env.MI_DOCUMENT_REVIEW !== 'false',
  shadowMode: process.env.MI_SHADOW_MODE === 'true',
  /** v2 drafting engine: section-by-section generation + targeted repair. */
  draftEngineV2: process.env.DRAFT_ENGINE_V2 === 'true',
} as const;

export function isMiEnabled(consumer: keyof typeof MI_FEATURE_FLAGS): boolean {
  return MI_FEATURE_FLAGS[consumer] ?? true;
}
