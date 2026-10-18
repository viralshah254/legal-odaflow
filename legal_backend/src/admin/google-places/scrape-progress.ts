import {
  GOOGLE_PLACES_BATCH_SIZE,
  getDiscoveryStepTotal,
  type GooglePlacesScrapeMode,
} from './discovery.config';

export { GOOGLE_PLACES_BATCH_SIZE, getDiscoveryStepTotal };
export type { GooglePlacesScrapeMode };

/** Default discovery steps for full mode (2 text + 2×2 grid = 6). */
export const GOOGLE_PLACES_DISCOVERY_STEP_TOTAL = getDiscoveryStepTotal('full');

export interface GooglePlacesProspectCacheEntry {
  name: string;
  phone?: string | null;
  website?: string | null;
}

export interface GooglePlacesScrapeProgress {
  batchSize: number;
  placeIds: string[];
  completedBatchIndexes: number[];
  discoveryCompletedAt?: string;
  discoveryStep?: number;
  discoveryStepTotal?: number;
  discoveryStepLabel?: string;
  lastProgressAt?: string;
  cancelRequestedAt?: string;
  scrapeMode?: GooglePlacesScrapeMode;
  apiVersion?: 'new' | 'legacy';
  /** Contact fields returned from Places API (New) search — avoids Details calls. */
  prospectCache?: Record<string, GooglePlacesProspectCacheEntry>;
  /** Geocoded center for grid-based nearby search (any city). */
  locationLat?: number;
  locationLng?: number;
}

export function isGooglePlacesRunCancelled(progress: GooglePlacesScrapeProgress): boolean {
  return typeof progress.cancelRequestedAt === 'string' && progress.cancelRequestedAt.length > 0;
}

export function emptyGooglePlacesProgress(
  mode: GooglePlacesScrapeMode = 'full',
): GooglePlacesScrapeProgress {
  return {
    batchSize: GOOGLE_PLACES_BATCH_SIZE,
    placeIds: [],
    completedBatchIndexes: [],
    scrapeMode: mode,
    apiVersion: 'new',
    prospectCache: {},
  };
}

export function parseGooglePlacesProgress(raw: unknown): GooglePlacesScrapeProgress {
  if (!raw || typeof raw !== 'object') return emptyGooglePlacesProgress();
  const data = raw as Partial<GooglePlacesScrapeProgress>;
  const mode = data.scrapeMode === 'enrichment' ? 'enrichment' : 'full';
  return {
    batchSize: data.batchSize ?? GOOGLE_PLACES_BATCH_SIZE,
    placeIds: Array.isArray(data.placeIds) ? data.placeIds.filter(Boolean) : [],
    completedBatchIndexes: Array.isArray(data.completedBatchIndexes)
      ? data.completedBatchIndexes.filter((n) => typeof n === 'number')
      : [],
    discoveryCompletedAt:
      typeof data.discoveryCompletedAt === 'string' ? data.discoveryCompletedAt : undefined,
    discoveryStep: typeof data.discoveryStep === 'number' ? data.discoveryStep : undefined,
    discoveryStepTotal:
      typeof data.discoveryStepTotal === 'number'
        ? data.discoveryStepTotal
        : getDiscoveryStepTotal(mode),
    discoveryStepLabel:
      typeof data.discoveryStepLabel === 'string' ? data.discoveryStepLabel : undefined,
    lastProgressAt: typeof data.lastProgressAt === 'string' ? data.lastProgressAt : undefined,
    cancelRequestedAt:
      typeof data.cancelRequestedAt === 'string' ? data.cancelRequestedAt : undefined,
    scrapeMode: mode,
    apiVersion: data.apiVersion === 'legacy' ? 'legacy' : 'new',
    prospectCache:
      data.prospectCache && typeof data.prospectCache === 'object'
        ? (data.prospectCache as Record<string, GooglePlacesProspectCacheEntry>)
        : {},
    locationLat: typeof data.locationLat === 'number' ? data.locationLat : undefined,
    locationLng: typeof data.locationLng === 'number' ? data.locationLng : undefined,
  };
}

export function totalGooglePlacesBatches(
  placeIdCount: number,
  batchSize = GOOGLE_PLACES_BATCH_SIZE,
): number {
  if (placeIdCount <= 0) return 0;
  return Math.ceil(placeIdCount / batchSize);
}

export function isGooglePlacesBatchComplete(
  progress: GooglePlacesScrapeProgress,
  batchIndex: number,
): boolean {
  return progress.completedBatchIndexes.includes(batchIndex);
}

export function nextGooglePlacesBatchIndex(progress: GooglePlacesScrapeProgress): number {
  const total = totalGooglePlacesBatches(progress.placeIds.length, progress.batchSize);
  for (let i = 0; i < total; i++) {
    if (!progress.completedBatchIndexes.includes(i)) return i;
  }
  return total;
}

export function hasContactInCache(
  cache: Record<string, GooglePlacesProspectCacheEntry> | undefined,
  placeId: string,
): boolean {
  const entry = cache?.[placeId];
  return !!(entry?.phone || entry?.website);
}
