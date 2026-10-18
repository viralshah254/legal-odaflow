import type { PricingPlansResult } from "@/lib/api/pricing-plans"
import { CANONICAL_CURRENCY } from "@/lib/pricing/country-pricing"

/** Placeholder until client-side geo + catalog fetch completes. */
export function emptyPricingCatalog(): PricingPlansResult {
  return {
    countryCode: "",
    currency: CANONICAL_CURRENCY,
    plans: [],
  }
}
