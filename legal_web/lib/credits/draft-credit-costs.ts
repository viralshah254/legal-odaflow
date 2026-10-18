/**
 * Mirrors backend credit-costs.ts DRAFT_CREDIT_FLOORS for UI copy.
 *
 * Draft floors are complexity-banded based on real API costs (model-costs.config.ts):
 *   SIMPLE_DRAFT:   GPT-5.4-mini single pass  → ~$0.003–0.005 → 5 cr floor
 *   STANDARD_DRAFT: GPT Sol/Terra × 2 passes  → ~$0.08–0.12  → 18 cr floor (UI estimate)
 *   COMPLEX_DRAFT:  GPT Sol + Terra enrich     → ~$0.15–0.25  → 33 cr floor (UI estimate)
 *
 * The UI shows the STANDARD band as the default "from N credits" estimate;
 * the actual charge depends on document type and whether "Higher accuracy" mode is enabled.
 */
export const DRAFT_CREDIT_COSTS = {
  SEARCH: 5,
  /** Simple forms, notices, agreements — GPT-mini single pass (~$0.003–0.005) */
  SIMPLE_DRAFT: 5,
  /** Standard pleadings, contracts — GPT Sol/Terra × 2 passes */
  STANDARD_DRAFT: 18,
  /** Complex litigation: bail, writ, appeal — GPT Sol + Terra enrich */
  COMPLEX_DRAFT: 33,
  /** Default shown in UI when complexity is unknown — standard band */
  FULL_DRAFT: 18,
  EDIT: 1,
  EXTRACT_FIELDS: 15,
} as const

export type DraftCreditCostKey = keyof typeof DRAFT_CREDIT_COSTS
