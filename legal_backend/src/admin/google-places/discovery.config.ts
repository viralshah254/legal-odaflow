/** DB/worker checkpoint size — not a Google API batch limit. */
export const GOOGLE_PLACES_BATCH_SIZE = 50;

/** Trimmed from 3 → 2 to reduce Text Search SKU spend. */
export const TEXT_QUERY_TEMPLATES = [
  'law firm in {city}, {state}, {country}',
  'lawyer in {city}, {state}, {country}',
];

/** Trimmed from 3×3 → 2×2 grid to reduce Nearby Search SKU spend. */
export const GRID_OFFSETS = [-0.05, 0.05];

export const NEARBY_RADIUS_M = 5000;
export const PAGE_TOKEN_DELAY_MS = 2100;
export const REQUEST_DELAY_MS = 250;
export const REQUEST_TIMEOUT_MS = 30_000;

export type GooglePlacesScrapeMode = 'full' | 'enrichment';

/** Enrichment mode skips grid scans — text search only. */
export function getDiscoveryStepTotal(mode: GooglePlacesScrapeMode = 'full'): number {
  const textSteps = TEXT_QUERY_TEMPLATES.length;
  if (mode === 'enrichment') return textSteps;
  return textSteps + GRID_OFFSETS.length * GRID_OFFSETS.length;
}
