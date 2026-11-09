import { AI_USAGE_COST_MULTIPLIER, computeCreditsFromProviderCost } from '@/ai-credits/credit-pricing.util';
export type LegalResearchMode = 'FAST' | 'DEEP' | 'GUIDANCE';

export function isGuidanceResearch(mode?: string): boolean {
  return mode === 'GUIDANCE';
}

export function isFastResearch(mode?: string): boolean {
  return mode === 'FAST' || mode === 'GUIDANCE';
}

export function isVerifiedResearch(mode?: string): boolean {
  return mode === 'DEEP';
}

/** Fast/Guidance never inherit a Premium/Ultra override. */
export function shouldIgnorePremiumOverride(mode?: string): boolean {
  return isFastResearch(mode);
}

export function researchDeadlineMs(mode?: string, contextChars = 0): number {
  if (contextChars > LONG_RESEARCH_QUERY_CHARS) {
    return mode === 'GUIDANCE' ? 30_000 : mode === 'FAST' ? 60_000 : 90_000;
  }
  if (mode === 'GUIDANCE') return 15_000;
  if (mode === 'FAST') return 25_000;
  return 60_000;
}

export function researchRetrievalBudgetMs(mode?: string): number {
  if (mode === 'GUIDANCE') return 0;
  if (mode === 'FAST') return 8_000;
  return 18_000;
}

export const LONG_RESEARCH_QUERY_CHARS = 4_000;
export const RESEARCH_QUESTION_MAX_CHARS = 400;
export const RESEARCH_PROMPT_QUERY_MAX_CHARS = 6_000;

export const CALM_RESEARCH_FALLBACK_REASON =
  'Here is a first-pass note from the question and contract text. A fuller memo was not ready in time.';

export function researchSynthesisTimeoutMs(mode?: string, queryChars = 0, contextChars = 0): number {
  if (contextChars > LONG_RESEARCH_QUERY_CHARS) {
    return mode === 'GUIDANCE' ? 20_000 : mode === 'FAST' ? 45_000 : 60_000;
  }
  const base = mode === 'GUIDANCE' ? 10_000 : mode === 'FAST' ? 12_000 : 28_000;
  if (queryChars > LONG_RESEARCH_QUERY_CHARS && (mode === 'GUIDANCE' || mode === 'FAST')) {
    return researchDeadlineMs(mode);
  }
  return base;
}

export function looksLikeDocumentDump(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length > RESEARCH_QUESTION_MAX_CHARS) return true;
  return /\b(SOFTWARE IMPLEMENTATION|THIS AGREEMENT|WITNESSETH|IN WITNESS WHEREOF|SIGNED CONTRACT|AGREEMENT dated)\b/i.test(
    trimmed,
  );
}

export function extractResearchQuestionPresented(query: string): string {
  const trimmed = query.trim();
  if (!trimmed) return '';

  const contractStart = trimmed.search(
    /\n\s*(SOFTWARE IMPLEMENTATION|THIS AGREEMENT|AGREEMENT dated|WITNESSETH|PARTIES:|WHEREAS\b)/i,
  );
  const head = contractStart > 40 ? trimmed.slice(0, contractStart) : trimmed;
  const sentences = head
    .split(/(?<=[.?!])\s+/)
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const pick = sentences.slice(0, 3).join(' ');
  const compact = (pick || head).replace(/\s+/g, ' ').trim();
  if (compact.length <= RESEARCH_QUESTION_MAX_CHARS) return compact;
  return `${compact.slice(0, RESEARCH_QUESTION_MAX_CHARS - 1).trimEnd()}…`;
}

export function normalizeResearchQuestionPresented(
  candidate: string | undefined,
  rawQuery: string,
): string {
  const trimmed = candidate?.trim() ?? '';
  if (trimmed && !looksLikeDocumentDump(trimmed)) return trimmed;
  return extractResearchQuestionPresented(rawQuery) || trimmed.slice(0, RESEARCH_QUESTION_MAX_CHARS);
}

export function compactResearchQueryForPrompt(
  query: string,
  maxChars = RESEARCH_PROMPT_QUERY_MAX_CHARS,
): string {
  if (query.length <= maxChars) return query;
  const question = extractResearchQuestionPresented(query);
  const head = query.slice(0, 2_400);
  const tail = query.slice(-1_400);
  return [
    question,
    '',
    '[Contract excerpt — beginning]',
    head,
    '',
    '[… middle omitted for length …]',
    '',
    '[Contract excerpt — end]',
    tail,
  ].join('\n');
}

export function isResearchStallOrTimeoutError(err?: unknown): boolean {
  const msg = err instanceof Error ? err.message : typeof err === 'string' ? err : '';
  return /stalled|allowable limit|Missing lock|timed out|timeout|taking longer|deadline|first-pass|exceeded|aborted/i.test(
    msg,
  );
}

export function researchFallbackReason(err?: unknown): string {
  const msg = err instanceof Error ? err.message : typeof err === 'string' ? err : '';
  if (!msg.trim() || isResearchStallOrTimeoutError(msg)) {
    return CALM_RESEARCH_FALLBACK_REASON;
  }
  return msg.trim();
}

/** Mid-tier Terra — Verified must not sit on Sol / Ultra / xhigh reasoning. */
export const VERIFIED_RESEARCH_MODEL = 'gpt-5.6-terra';

export function isUltraOrSolResearchModel(modelId?: string): boolean {
  const id = (modelId ?? '').toLowerCase();
  return (
    id.includes('sol') ||
    id.includes('ultra') ||
    id.includes('opus') ||
    /\bo3\b/.test(id) ||
    /\bo4\b/.test(id) ||
    id.includes('xhigh')
  );
}

export function capVerifiedResearchModel(modelId: string | undefined): string {
  if (!modelId?.trim() || isUltraOrSolResearchModel(modelId)) {
    return VERIFIED_RESEARCH_MODEL;
  }
  return modelId;
}

export function researchMustStartSynthesisByMs(mode?: string): number {
  if (mode === 'GUIDANCE') return 1_000;
  if (mode === 'FAST') return 8_000;
  return 22_000;
}

export const RESEARCH_COST_MARKUP = AI_USAGE_COST_MULTIPLIER;

export function computeResearchCreditsFromCost(
  providerCostUsd: number,
  creditUsdValue = 0.01,
  _minCredits = 0,
): number {
  return computeCreditsFromProviderCost(providerCostUsd, creditUsdValue);
}

export function buildFallbackResearchMemo(input: {
  query: string;
  countryCode?: string;
  jurisdiction?: string;
  researchMode?: string;
  reason?: string;
}): string {
  const where = [input.jurisdiction, input.countryCode].filter(Boolean).join(' / ') || 'the selected jurisdiction';
  return [
    '# Legal research note',
    '',
    `**Jurisdiction:** ${where}`,
    '',
    CALM_RESEARCH_FALLBACK_REASON,
    '',
    input.researchMode === 'GUIDANCE' || input.researchMode === 'FAST'
      ? '*Unverified AI guidance — model knowledge only.*'
      : '*Lawyer review required.*',
  ].join('\n');
}
