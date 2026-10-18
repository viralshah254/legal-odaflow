import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Job } from 'bullmq';
import {
  LawyerProspectsService,
  type ProspectUpsertInput,
} from './lawyer-prospects.service';
import {
  getGooglePlacesLocationTree,
  GOOGLE_PLACES_COUNTRIES,
  type ResolvedGooglePlacesLocation,
} from './google-places/cities.config';
import {
  resolveGooglePlacesLocation,
  resolveGooglePlacesLocationFromProgress,
} from './google-places/location-resolver';
import {
  getDiscoveryStepTotal,
  GRID_OFFSETS,
  NEARBY_RADIUS_M,
  PAGE_TOKEN_DELAY_MS,
  REQUEST_DELAY_MS,
  TEXT_QUERY_TEMPLATES,
  type GooglePlacesScrapeMode,
} from './google-places/discovery.config';
import {
  displayNameFromPlace,
  GooglePlacesNewClient,
  phoneFromPlace,
  placeIdFromResourceName,
  type PlacesNewPlace,
} from './google-places/places-new.client';
import {
  GOOGLE_PLACES_BATCH_SIZE,
  hasContactInCache,
  isGooglePlacesBatchComplete,
  isGooglePlacesRunCancelled,
  nextGooglePlacesBatchIndex,
  totalGooglePlacesBatches,
  type GooglePlacesScrapeProgress,
} from './google-places/scrape-progress';

export class GooglePlacesScrapeCancelledError extends Error {
  constructor() {
    super('Google Places scrape cancelled');
    this.name = 'GooglePlacesScrapeCancelledError';
  }
}

const SOURCE = 'google_places';
const TEXT_SEARCH_URL = 'https://maps.googleapis.com/maps/api/place/textsearch/json';
const NEARBY_SEARCH_URL = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json';
const PLACE_DETAILS_URL = 'https://maps.googleapis.com/maps/api/place/details/json';
const LOCK_EXTEND_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 30_000;

const DETAILS_FIELDS = [
  'place_id',
  'name',
  'types',
  'formatted_phone_number',
  'international_phone_number',
  'website',
  'url',
].join(',');

const LEGAL_TYPES = new Set([
  'lawyer',
  'attorney',
  'legal_service',
  'local_government_office',
  'point_of_interest',
  'establishment',
]);

export interface GooglePlacesScrapeJobContext {
  extendLock?: () => Promise<void>;
  reportProgress?: (payload: Record<string, unknown>) => Promise<void>;
}

interface PlaceSearchResult {
  place_id?: string;
  name?: string;
  types?: string[];
}

interface PlaceDetailsResult {
  place_id?: string;
  name?: string;
  types?: string[];
  formatted_phone_number?: string;
  international_phone_number?: string;
  website?: string;
  url?: string;
}

@Injectable()
export class GooglePlacesProspectService {
  private readonly logger = new Logger(GooglePlacesProspectService.name);
  private readonly placesNew = new GooglePlacesNewClient();

  constructor(
    private readonly config: ConfigService,
    private readonly lawyerProspectsService: LawyerProspectsService,
  ) {}

  useNewApi(): boolean {
    return this.config.get<string>('GOOGLE_PLACES_USE_NEW_API') !== 'false';
  }

  getLocationTree() {
    return getGooglePlacesLocationTree();
  }

  private async resolveScrapeLocation(
    countryCode: string,
    stateName: string,
    cityName: string,
    progress?: GooglePlacesScrapeProgress,
  ): Promise<ResolvedGooglePlacesLocation> {
    const fromProgress = resolveGooglePlacesLocationFromProgress(
      countryCode,
      stateName,
      cityName,
      progress,
    );
    if (fromProgress) return fromProgress;

    return resolveGooglePlacesLocation(
      this.requireApiKey(),
      countryCode,
      stateName,
      cityName,
    );
  }

  jobContextFromBullJob(job: Job): GooglePlacesScrapeJobContext {
    return {
      extendLock: async () => {
        if (job.token) await job.extendLock(job.token, LOCK_EXTEND_MS);
      },
      reportProgress: async (payload) => {
        await job.updateProgress(payload);
      },
    };
  }

  async testApiKey(city = 'Ahmedabad', state = 'Gujarat', countryName = 'India') {
    const apiKey = this.requireApiKey();
    const query = `law firm in ${city}, ${state}, ${countryName}`;

    if (this.useNewApi()) {
      try {
        const { places, apiCalls } = await this.placesNew.searchText(apiKey, query, 'in');
        const sample = places[0];
        return {
          ok: places.length > 0,
          configured: true,
          apiVersion: 'new' as const,
          status: 'OK',
          error: null,
          resultCount: places.length,
          sampleName: sample ? displayNameFromPlace(sample) : null,
          samplePhone: sample ? phoneFromPlace(sample) : null,
          apiCalls,
          query,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          ok: false,
          configured: true,
          apiVersion: 'new' as const,
          status: 'HTTP_ERROR',
          error: message,
          resultCount: 0,
          sampleName: null,
          query,
        };
      }
    }

    try {
      const params = new URLSearchParams({ query, key: apiKey, region: 'in' });
      const data = await this.getJson<{
        results?: PlaceSearchResult[];
        status?: string;
        error_message?: string;
      }>(`${TEXT_SEARCH_URL}?${params.toString()}`);
      const ok = data.status === 'OK' || data.status === 'ZERO_RESULTS';
      return {
        ok,
        configured: true,
        apiVersion: 'legacy' as const,
        status: data.status ?? 'UNKNOWN',
        error: data.error_message ?? null,
        resultCount: data.results?.length ?? 0,
        sampleName: data.results?.[0]?.name ?? null,
        query,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        configured: true,
        apiVersion: 'legacy' as const,
        status: 'HTTP_ERROR',
        error: message,
        resultCount: 0,
        sampleName: null,
        query,
      };
    }
  }

  /** Compare Legacy vs New API billable call counts for a city (admin spike). */
  async compareApiApproaches(
    city: string,
    state: string,
    countryName: string,
    limit = 100,
  ) {
    const apiKey = this.requireApiKey();
    const country =
      GOOGLE_PLACES_COUNTRIES.find(
        (c) => c.name.toLowerCase() === countryName.trim().toLowerCase(),
      ) ?? GOOGLE_PLACES_COUNTRIES.find((c) => c.code === countryName.trim().toUpperCase());
    if (!country) {
      throw new Error(`Unsupported country: ${countryName}`);
    }
    const location = await resolveGooglePlacesLocation(apiKey, country.code, state, city);

    const query = this.buildQuery(TEXT_QUERY_TEMPLATES[0], location);

    let legacySearchCalls = 0;
    let legacyPlaceIds: string[] = [];
    const params = new URLSearchParams({ query, key: apiKey, region: location.regionCode });
    const legacyPage = await this.getJson<{
      results?: PlaceSearchResult[];
      status?: string;
    }>(`${TEXT_SEARCH_URL}?${params.toString()}`);
    legacySearchCalls += 1;
    legacyPlaceIds = (legacyPage.results ?? [])
      .filter((p) => p.place_id && this.isLegalSearchResult(p))
      .map((p) => p.place_id!)
      .slice(0, limit);

    const legacyDetailCalls = legacyPlaceIds.length;
    let legacyWithPhone = 0;
    for (const pid of legacyPlaceIds.slice(0, Math.min(10, limit))) {
      const d = await this.fetchLegacyPlaceDetails(apiKey, pid);
      if (d?.formatted_phone_number || d?.international_phone_number) legacyWithPhone++;
      await this.sleep(REQUEST_DELAY_MS);
    }

    let newSearchCalls = 0;
    let newDetailCalls = 0;
    let newWithPhone = 0;
    let newPlaceCount = 0;
    try {
      const { places, apiCalls } = await this.placesNew.searchText(
        apiKey,
        query,
        location.regionCode,
      );
      newSearchCalls = apiCalls;
      const sample = places.slice(0, limit);
      newPlaceCount = sample.length;
      for (const place of sample) {
        const phone = phoneFromPlace(place);
        const website = place.websiteUri;
        if (phone || website) newWithPhone++;
        if (!phone && !website) {
          const pid = placeIdFromResourceName(place.id);
          if (pid) {
            newDetailCalls += 1;
            const detail = await this.placesNew.getPlace(apiKey, pid);
            if (phoneFromPlace(detail ?? {}) || detail?.websiteUri) newWithPhone++;
          }
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        city,
        state,
        query,
        limit,
        legacy: {
          searchCalls: legacySearchCalls,
          detailCalls: legacyDetailCalls,
          totalCalls: legacySearchCalls + legacyDetailCalls,
          firmsSampled: legacyPlaceIds.length,
          withPhoneInSample: legacyWithPhone,
          sampleSize: Math.min(10, legacyPlaceIds.length),
        },
        newApi: {
          error: message,
          searchCalls: 0,
          detailCalls: 0,
          totalCalls: 0,
          firmsSampled: 0,
          withPhoneInSample: 0,
        },
        savingsPercent: 0,
        recommendation:
          'Enable Places API (New) in GCP and set GOOGLE_PLACES_USE_NEW_API=true',
      };
    }

    const legacyTotal = legacySearchCalls + legacyDetailCalls;
    const newTotal = newSearchCalls + newDetailCalls;
    const savingsPercent =
      legacyTotal > 0 ? Math.round(((legacyTotal - newTotal) / legacyTotal) * 100) : 0;

    return {
      city,
      state,
      query,
      limit,
      legacy: {
        searchCalls: legacySearchCalls,
        detailCalls: legacyDetailCalls,
        totalCalls: legacyTotal,
        firmsSampled: legacyPlaceIds.length,
        withPhoneInSample: legacyWithPhone,
        sampleSize: Math.min(10, legacyPlaceIds.length),
        note: 'Legacy requires one Place Details call per firm for phone/website',
      },
      newApi: {
        searchCalls: newSearchCalls,
        detailCalls: newDetailCalls,
        totalCalls: newTotal,
        firmsSampled: newPlaceCount,
        withPhoneInSample: newWithPhone,
        note: 'New API returns phone/website in searchText when field mask includes them',
      },
      savingsPercent,
      recommendation:
        savingsPercent > 0
          ? `Places API (New) saves ~${savingsPercent}% billable calls for this sample`
          : 'New API available — enable in GCP for contact fields on search',
    };
  }

  async scrapeAndImport(
    countryCode: string,
    stateName: string,
    cityName: string,
    runId: string,
    jobContext?: GooglePlacesScrapeJobContext,
    scrapeMode: GooglePlacesScrapeMode = 'full',
  ): Promise<void> {
    let progress = await this.lawyerProspectsService.getGooglePlacesProgress(runId);
    const location = await this.resolveScrapeLocation(
      countryCode,
      stateName,
      cityName,
      progress,
    );

    if (progress.locationLat == null || progress.locationLng == null) {
      progress = {
        ...progress,
        locationLat: location.lat,
        locationLng: location.lng,
      };
      await this.lawyerProspectsService.saveGooglePlacesProgress(runId, progress);
    }

    const apiKey = this.requireApiKey();
    const useNew = this.useNewApi();
    const mode = progress.scrapeMode ?? scrapeMode;
    const stepTotal = getDiscoveryStepTotal(mode);

    if (!progress.scrapeMode) {
      progress = {
        ...progress,
        scrapeMode: mode,
        apiVersion: useNew ? 'new' : 'legacy',
        prospectCache: progress.prospectCache ?? {},
      };
      await this.lawyerProspectsService.saveGooglePlacesProgress(runId, progress);
    }

    await this.assertNotCancelled(runId, progress);

    if (!progress.discoveryCompletedAt) {
      await jobContext?.reportProgress?.({ phase: 'discovery', batchIndex: 0, totalBatches: 0 });
      await jobContext?.extendLock?.();

      progress = {
        ...progress,
        discoveryStep: progress.discoveryStep ?? 0,
        discoveryStepTotal: stepTotal,
        discoveryStepLabel: 'Starting Google Maps discovery…',
        lastProgressAt: new Date().toISOString(),
      };
      await this.lawyerProspectsService.saveGooglePlacesProgress(runId, progress);

      const saveDiscoveryProgress = async (patch: Partial<GooglePlacesScrapeProgress>) => {
        await this.assertNotCancelled(runId, progress);
        await jobContext?.extendLock?.();
        progress = {
          ...progress,
          ...patch,
          discoveryStepTotal: stepTotal,
          lastProgressAt: new Date().toISOString(),
        };
        await this.lawyerProspectsService.saveGooglePlacesProgress(runId, progress);
        await jobContext?.reportProgress?.({
          phase: 'discovery',
          discoveryStep: progress.discoveryStep,
          discoveryStepTotal: stepTotal,
          placeIdCount: progress.placeIds.length,
        });
      };

      const discovery = useNew
        ? await this.discoverViaNewApi(apiKey, location, mode, progress, saveDiscoveryProgress)
        : await this.discoverViaLegacyApi(apiKey, location, mode, progress, saveDiscoveryProgress);

      progress = {
        ...progress,
        placeIds: discovery.placeIds,
        prospectCache: discovery.prospectCache,
        discoveryCompletedAt: new Date().toISOString(),
        discoveryStep: stepTotal,
        discoveryStepTotal: stepTotal,
        discoveryStepLabel: undefined,
        lastProgressAt: new Date().toISOString(),
      };
      await this.lawyerProspectsService.saveGooglePlacesProgress(runId, progress);

      this.logger.log(
        `Google Places discovery (${useNew ? 'new' : 'legacy'}): ` +
          `${progress.placeIds.length} place_ids for ${location.city}`,
      );
    }

    const totalBatches = totalGooglePlacesBatches(
      progress.placeIds.length,
      progress.batchSize,
    );
    if (totalBatches === 0) {
      await this.lawyerProspectsService.finalizeGooglePlacesImport(runId);
      return;
    }

    await this.importRemainingBatches(
      apiKey,
      location,
      runId,
      progress,
      jobContext,
      useNew,
    );

    await this.lawyerProspectsService.finalizeGooglePlacesImport(runId);
    await jobContext?.reportProgress?.({
      phase: 'done',
      batchIndex: totalBatches,
      totalBatches,
      completedBatches: totalBatches,
    });
  }

  async importCollectedPlaceIds(runId: string) {
    const run = await this.lawyerProspectsService.getImportRunForFinalize(runId);
    let progress = await this.lawyerProspectsService.getGooglePlacesProgress(runId);
    const location = await this.resolveScrapeLocation(
      run.countryCode,
      run.state,
      run.city,
      progress,
    );

    const apiKey = this.requireApiKey();
    if (progress.placeIds.length === 0) {
      return { placeCount: 0, importedBatches: 0 };
    }

    if (!progress.discoveryCompletedAt) {
      progress = {
        ...progress,
        discoveryCompletedAt: new Date().toISOString(),
        lastProgressAt: new Date().toISOString(),
      };
      await this.lawyerProspectsService.saveGooglePlacesProgress(runId, progress);
    }

    const doneBefore = progress.completedBatchIndexes.length;
    progress = await this.importRemainingBatches(
      apiKey,
      location,
      runId,
      progress,
      undefined,
      this.useNewApi(),
    );
    return {
      placeCount: progress.placeIds.length,
      importedBatches: progress.completedBatchIndexes.length - doneBefore,
    };
  }

  private requireApiKey(): string {
    const apiKey = this.config.get<string>('GOOGLE_PLACES_API_KEY');
    if (!apiKey) throw new Error('GOOGLE_PLACES_API_KEY is not configured');
    return apiKey;
  }

  private async assertNotCancelled(runId: string, progress?: GooglePlacesScrapeProgress) {
    const current = progress ?? (await this.lawyerProspectsService.getGooglePlacesProgress(runId));
    if (isGooglePlacesRunCancelled(current)) {
      throw new GooglePlacesScrapeCancelledError();
    }
  }

  private async importRemainingBatches(
    apiKey: string,
    location: ResolvedGooglePlacesLocation,
    runId: string,
    initialProgress: GooglePlacesScrapeProgress,
    jobContext?: GooglePlacesScrapeJobContext,
    useNew = true,
  ): Promise<GooglePlacesScrapeProgress> {
    let progress = initialProgress;
    const enrichmentOnly = progress.scrapeMode === 'enrichment';
    const totalBatches = totalGooglePlacesBatches(
      progress.placeIds.length,
      progress.batchSize,
    );

    let batchIndex = nextGooglePlacesBatchIndex(progress);
    while (batchIndex < totalBatches) {
      await this.assertNotCancelled(runId, progress);
      if (isGooglePlacesBatchComplete(progress, batchIndex)) {
        batchIndex = nextGooglePlacesBatchIndex(progress);
        continue;
      }

      await jobContext?.extendLock?.();
      await jobContext?.reportProgress?.({
        phase: 'details',
        batchIndex,
        totalBatches,
        completedBatches: progress.completedBatchIndexes.length,
        placeIdCount: progress.placeIds.length,
      });

      const start = batchIndex * progress.batchSize;
      const batchPlaceIds = progress.placeIds.slice(start, start + progress.batchSize);
      const prospects = useNew
        ? await this.fetchProspectsNew(apiKey, batchPlaceIds, location, progress.prospectCache)
        : await this.fetchProspectsLegacy(apiKey, batchPlaceIds, location);

      await this.lawyerProspectsService.upsertGooglePlacesBatch(runId, prospects, {
        enrichmentOnly,
      });

      progress = {
        ...progress,
        completedBatchIndexes: [...progress.completedBatchIndexes, batchIndex].sort(
          (a, b) => a - b,
        ),
        lastProgressAt: new Date().toISOString(),
      };
      await this.lawyerProspectsService.saveGooglePlacesProgress(runId, progress);

      this.logger.log(
        `Google Places batch ${batchIndex + 1}/${totalBatches} done (${prospects.length} prospects)`,
      );
      batchIndex = nextGooglePlacesBatchIndex(progress);
    }

    return progress;
  }

  private async discoverViaNewApi(
    apiKey: string,
    location: ResolvedGooglePlacesLocation,
    mode: GooglePlacesScrapeMode,
    progress: GooglePlacesScrapeProgress,
    save: (patch: Partial<GooglePlacesScrapeProgress>) => Promise<void>,
  ) {
    const placeIds = new Set(progress.placeIds);
    const prospectCache = { ...(progress.prospectCache ?? {}) };
    let stepIndex = progress.discoveryStep ?? 0;

    const ingestPlaces = (places: PlacesNewPlace[]) => {
      for (const place of places) {
        if (!this.isLegalNewPlace(place)) continue;
        const pid = placeIdFromResourceName(place.id);
        if (!pid) continue;
        placeIds.add(pid);
        prospectCache[pid] = {
          name: displayNameFromPlace(place) ?? pid,
          phone: phoneFromPlace(place),
          website: place.websiteUri ?? null,
        };
      }
    };

    for (let i = 0; i < TEXT_QUERY_TEMPLATES.length; i++) {
      const globalStep = i + 1;
      if (stepIndex >= globalStep) continue;
      const query = this.buildQuery(TEXT_QUERY_TEMPLATES[i], location);
      const label = `Text search ${i + 1}/${TEXT_QUERY_TEMPLATES.length}`;
      await save({
        placeIds: [...placeIds],
        discoveryStep: globalStep - 1,
        discoveryStepLabel: `${label}…`,
      });
      const { places } = await this.placesNew.searchText(apiKey, query, location.regionCode, {
        lat: location.lat,
        lng: location.lng,
      });
      ingestPlaces(places);
      stepIndex = globalStep;
      await save({
        placeIds: [...placeIds],
        discoveryStep: globalStep,
        discoveryStepLabel: label,
        prospectCache,
      });
      await this.sleep(REQUEST_DELAY_MS);
    }

    if (mode === 'full') {
      let gridStep = 0;
      const gridTotal = GRID_OFFSETS.length * GRID_OFFSETS.length;
      for (const dLat of GRID_OFFSETS) {
        for (const dLng of GRID_OFFSETS) {
          gridStep += 1;
          const globalStep = TEXT_QUERY_TEMPLATES.length + gridStep;
          if (stepIndex >= globalStep) continue;
          const label = `Area scan ${gridStep}/${gridTotal}`;
          await save({
            placeIds: [...placeIds],
            discoveryStep: globalStep - 1,
            discoveryStepLabel: `${label}…`,
          });
          const { places } = await this.placesNew.searchText(
            apiKey,
            `lawyer in ${location.city}, ${location.state}`,
            location.regionCode,
            {
              lat: location.lat + dLat,
              lng: location.lng + dLng,
              radiusM: NEARBY_RADIUS_M,
            },
          );
          ingestPlaces(places);
          stepIndex = globalStep;
          await save({
            placeIds: [...placeIds],
            discoveryStep: globalStep,
            discoveryStepLabel: label,
            prospectCache,
          });
          await this.sleep(REQUEST_DELAY_MS);
        }
      }
    }

    return { placeIds: [...placeIds], prospectCache };
  }

  private async discoverViaLegacyApi(
    apiKey: string,
    location: ResolvedGooglePlacesLocation,
    mode: GooglePlacesScrapeMode,
    progress: GooglePlacesScrapeProgress,
    save: (patch: Partial<GooglePlacesScrapeProgress>) => Promise<void>,
  ) {
    const placeIds = new Set(progress.placeIds);
    let stepIndex = progress.discoveryStep ?? 0;

    for (let i = 0; i < TEXT_QUERY_TEMPLATES.length; i++) {
      const globalStep = i + 1;
      if (stepIndex >= globalStep) continue;
      const query = this.buildQuery(TEXT_QUERY_TEMPLATES[i], location);
      const label = `Text search ${i + 1}/${TEXT_QUERY_TEMPLATES.length}`;
      await save({ placeIds: [...placeIds], discoveryStep: globalStep - 1, discoveryStepLabel: `${label}…` });
      await this.fetchLegacyTextSearch(apiKey, query, location.regionCode, (ids) =>
        ids.forEach((id) => placeIds.add(id)),
      );
      stepIndex = globalStep;
      await save({ placeIds: [...placeIds], discoveryStep: globalStep, discoveryStepLabel: label });
      await this.sleep(REQUEST_DELAY_MS);
    }

    if (mode === 'full') {
      let gridStep = 0;
      const gridTotal = GRID_OFFSETS.length * GRID_OFFSETS.length;
      for (const dLat of GRID_OFFSETS) {
        for (const dLng of GRID_OFFSETS) {
          gridStep += 1;
          const globalStep = TEXT_QUERY_TEMPLATES.length + gridStep;
          if (stepIndex >= globalStep) continue;
          const label = `Area scan ${gridStep}/${gridTotal}`;
          await save({ placeIds: [...placeIds], discoveryStep: globalStep - 1, discoveryStepLabel: `${label}…` });
          await this.fetchLegacyNearbySearch(
            apiKey,
            location.lat + dLat,
            location.lng + dLng,
            (ids) => ids.forEach((id) => placeIds.add(id)),
          );
          stepIndex = globalStep;
          await save({ placeIds: [...placeIds], discoveryStep: globalStep, discoveryStepLabel: label });
          await this.sleep(REQUEST_DELAY_MS);
        }
      }
    }

    return { placeIds: [...placeIds], prospectCache: progress.prospectCache ?? {} };
  }

  private async fetchProspectsNew(
    apiKey: string,
    placeIds: string[],
    location: ResolvedGooglePlacesLocation,
    cache: Record<string, { name: string; phone?: string | null; website?: string | null }> = {},
  ): Promise<ProspectUpsertInput[]> {
    const prospects: ProspectUpsertInput[] = [];

    for (const placeId of placeIds) {
      let name = cache[placeId]?.name;
      let phone = cache[placeId]?.phone ?? null;
      let website = cache[placeId]?.website ?? null;
      let profileUrl = `https://www.google.com/maps/place/?q=place_id:${placeId}`;

      if (!hasContactInCache(cache, placeId)) {
        const detail = await this.placesNew.getPlace(apiKey, placeId);
        if (detail) {
          name = displayNameFromPlace(detail) ?? name;
          phone = phoneFromPlace(detail) ?? phone;
          website = detail.websiteUri ?? website;
          profileUrl = detail.googleMapsUri ?? profileUrl;
        }
        await this.sleep(REQUEST_DELAY_MS);
      } else if (!name) {
        await this.sleep(50);
      }

      if (!name) continue;

      prospects.push({
        fullName: name,
        organisation: name,
        city: location.city,
        state: location.state,
        country: location.countryCode,
        phone,
        website,
        profileUrl,
        source: SOURCE,
      });
    }

    return prospects;
  }

  private async fetchProspectsLegacy(
    apiKey: string,
    placeIds: string[],
    location: ResolvedGooglePlacesLocation,
  ): Promise<ProspectUpsertInput[]> {
    const prospects: ProspectUpsertInput[] = [];
    for (const placeId of placeIds) {
      const details = await this.fetchLegacyPlaceDetails(apiKey, placeId);
      if (!details?.name || !this.isLegalLegacyDetails(details)) {
        await this.sleep(REQUEST_DELAY_MS);
        continue;
      }
      prospects.push({
        fullName: details.name,
        organisation: details.name,
        city: location.city,
        state: location.state,
        country: location.countryCode,
        phone: details.international_phone_number ?? details.formatted_phone_number ?? null,
        website: details.website ?? null,
        profileUrl: details.url ?? `https://www.google.com/maps/place/?q=place_id:${placeId}`,
        source: SOURCE,
      });
      await this.sleep(REQUEST_DELAY_MS);
    }
    return prospects;
  }

  private isLegalNewPlace(place: PlacesNewPlace): boolean {
    const types = place.types ?? [];
    if (!types.length) return true;
    return types.some(
      (t) =>
        LEGAL_TYPES.has(t) ||
        t.includes('lawyer') ||
        t.includes('legal') ||
        t.includes('attorney'),
    );
  }

  private isLegalLegacyDetails(details: PlaceDetailsResult): boolean {
    const types = details.types ?? [];
    if (!types.length) return true;
    return types.some(
      (t) =>
        LEGAL_TYPES.has(t) ||
        t.includes('lawyer') ||
        t.includes('legal') ||
        t.includes('attorney'),
    );
  }

  private isLegalSearchResult(place: PlaceSearchResult): boolean {
    const types = place.types ?? [];
    if (!types.length) return true;
    return types.some(
      (t) =>
        LEGAL_TYPES.has(t) ||
        t.includes('lawyer') ||
        t.includes('legal') ||
        t.includes('attorney'),
    );
  }

  private buildQuery(template: string, location: ResolvedGooglePlacesLocation): string {
    return template
      .replace('{city}', location.city)
      .replace('{state}', location.state)
      .replace('{country}', location.countryName);
  }

  private async fetchLegacyTextSearch(
    apiKey: string,
    query: string,
    regionCode: string,
    onPage: (ids: string[]) => void,
  ) {
    let pageToken: string | undefined;
    do {
      const params = new URLSearchParams({ query, key: apiKey, region: regionCode });
      if (pageToken) params.set('pagetoken', pageToken);
      const data = await this.getJson<{
        results?: PlaceSearchResult[];
        next_page_token?: string;
        status?: string;
      }>(`${TEXT_SEARCH_URL}?${params.toString()}`);
      if (data.status && !['OK', 'ZERO_RESULTS'].includes(data.status)) break;
      const pageIds = (data.results ?? [])
        .filter((p) => p.place_id && this.isLegalSearchResult(p))
        .map((p) => p.place_id!);
      onPage(pageIds);
      pageToken = data.next_page_token;
      if (pageToken) await this.sleep(PAGE_TOKEN_DELAY_MS);
    } while (pageToken);
  }

  private async fetchLegacyNearbySearch(
    apiKey: string,
    lat: number,
    lng: number,
    onPage: (ids: string[]) => void,
  ) {
    let pageToken: string | undefined;
    do {
      const params = new URLSearchParams({
        location: `${lat},${lng}`,
        radius: String(NEARBY_RADIUS_M),
        type: 'lawyer',
        key: apiKey,
      });
      if (pageToken) params.set('pagetoken', pageToken);
      const data = await this.getJson<{
        results?: PlaceSearchResult[];
        next_page_token?: string;
        status?: string;
      }>(`${NEARBY_SEARCH_URL}?${params.toString()}`);
      if (data.status && !['OK', 'ZERO_RESULTS'].includes(data.status)) break;
      const pageIds = (data.results ?? [])
        .filter((p) => p.place_id)
        .map((p) => p.place_id!);
      onPage(pageIds);
      pageToken = data.next_page_token;
      if (pageToken) await this.sleep(PAGE_TOKEN_DELAY_MS);
    } while (pageToken);
  }

  private async fetchLegacyPlaceDetails(
    apiKey: string,
    placeId: string,
  ): Promise<PlaceDetailsResult | null> {
    const params = new URLSearchParams({
      place_id: placeId,
      fields: DETAILS_FIELDS,
      key: apiKey,
    });
    const data = await this.getJson<{
      result?: PlaceDetailsResult;
      status?: string;
    }>(`${PLACE_DETAILS_URL}?${params.toString()}`);
    if (data.status !== 'OK' || !data.result) return null;
    return data.result;
  }

  private async getJson<T>(url: string): Promise<T> {
    const resp = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (!resp.ok) throw new Error(`Google Places HTTP ${resp.status}`);
    return resp.json() as Promise<T>;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export { GOOGLE_PLACES_BATCH_SIZE };
