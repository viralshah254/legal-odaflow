import type { SourceTier } from './legal-retrieval.types';

const PRIMARY_PATTERNS =
  /prs india|ncrb|legislative department|india code|bare act pdf|coi_2024|coi 2024/i;
const CASE_LAW_PATTERNS =
  /indian kanoon|courtlistener|air |scc |eklr|\[\d{4}\]|supreme court|high court|district court|circuit court|court of appeal|kenya law|judgments\.ecourt/i;
const FIRM_PATTERNS = /firm memory|firm artifact|vault|playbook|matter document/i;
const WEB_PATTERNS = /tavily|web search/i;

/**
 * Resolve the source tier from a source name and optional authority type string.
 *
 * The `authorityType` field on ingested authorities takes precedence when set to
 * 'CASE_LAW' or 'CASE' — this prevents Supreme Court / High Court judgments stored
 * in the corpus from being down-tiered to 'seed' when their source name does not
 * contain a recognisable connector pattern (e.g. "Supreme Court of India").
 */
export function resolveSourceTier(sourceName?: string | null, authorityType?: string | null): SourceTier {
  // Explicit authority-type override: DB ingestion records CASE_LAW as the canonical type.
  const normalizedType = (authorityType ?? '').toUpperCase();
  if (normalizedType === 'CASE_LAW' || normalizedType === 'CASE') return 'case_law';

  const name = sourceName ?? '';
  if (PRIMARY_PATTERNS.test(name)) return 'primary';
  if (CASE_LAW_PATTERNS.test(name)) return 'case_law';
  if (FIRM_PATTERNS.test(name)) return 'firm';
  if (WEB_PATTERNS.test(name)) return 'web';
  if (/seed|priority/i.test(name)) return 'seed';
  return 'seed';
}

export function rankAuthoritiesByTier<T extends { sourceTier: SourceTier; score?: number }>(
  rows: T[],
): T[] {
  const tierRank: Record<SourceTier, number> = {
    primary: 0,
    case_law: 1,
    firm: 2,
    seed: 3,
    web: 4,
  };
  return [...rows].sort(
    (a, b) =>
      tierRank[a.sourceTier] - tierRank[b.sourceTier] ||
      (b.score ?? 0) - (a.score ?? 0),
  );
}

export function summarizeSourceTiers(tiers: SourceTier[]): string {
  const counts = tiers.reduce<Record<string, number>>((acc, tier) => {
    acc[tier] = (acc[tier] ?? 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts)
    .map(([tier, count]) => `${tier}:${count}`)
    .join(', ');
}

/**
 * Returns true only when it is safe to exclude Tavily/web results from a bare-act query.
 * Safe = the query IS a bare-act query AND the specific requested section is already present
 * in a primary or seed authority.  If the section is missing we keep web results so the
 * LLM can use them to fill the gap.
 *
 * @param isBareActQuery  Whether the query was classified as a bare-act lookup.
 * @param sectionMissing  Whether the requested section is absent from retrieved authorities.
 *                        Pass `false` when there is no specific section (general query).
 * @param authorities     The current authority list.
 */
export function shouldBlockWebForBareAct(
  isBareActQuery: boolean,
  authorities: { sourceTier: SourceTier }[],
  sectionMissing = false,
): boolean {
  if (!isBareActQuery) return false;
  if (sectionMissing) return false;
  return authorities.some((a) => a.sourceTier === 'primary' || a.sourceTier === 'seed');
}
