import {
  findGooglePlacesCountry,
  resolveKnownGooglePlacesLocation,
  type ResolvedGooglePlacesLocation,
} from './cities.config';

const GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';
const REQUEST_TIMEOUT_MS = 30_000;

interface GeocodeResponse {
  status?: string;
  error_message?: string;
  results?: Array<{
    geometry?: { location?: { lat?: number; lng?: number } };
  }>;
}

/** Resolve a scrape location — known catalog first, then Google Geocoding API. */
export async function resolveGooglePlacesLocation(
  apiKey: string,
  countryCode: string,
  stateName: string,
  cityName: string,
): Promise<ResolvedGooglePlacesLocation> {
  const known = resolveKnownGooglePlacesLocation(countryCode, stateName, cityName);
  if (known) return known;

  const country = findGooglePlacesCountry(countryCode);
  if (!country) {
    throw new Error(`Unsupported country code: ${countryCode}`);
  }

  const state = stateName.trim();
  const city = cityName.trim();
  if (!city) {
    throw new Error('City is required');
  }

  const address = [city, state, country.name].filter(Boolean).join(', ');
  const params = new URLSearchParams({
    address,
    key: apiKey,
    region: country.regionCode,
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let data: GeocodeResponse;
  try {
    const res = await fetch(`${GEOCODE_URL}?${params.toString()}`, {
      signal: controller.signal,
    });
    data = (await res.json()) as GeocodeResponse;
  } finally {
    clearTimeout(timeout);
  }

  const lat = data.results?.[0]?.geometry?.location?.lat;
  const lng = data.results?.[0]?.geometry?.location?.lng;
  if (data.status !== 'OK' || typeof lat !== 'number' || typeof lng !== 'number') {
    const detail = data.error_message ?? data.status ?? 'UNKNOWN';
    throw new Error(`Could not locate "${address}" (${detail})`);
  }

  return {
    countryCode: country.code,
    countryName: country.name,
    regionCode: country.regionCode,
    state: state || country.name,
    city,
    lat,
    lng,
  };
}

/** Rebuild location from stored coordinates (for resumed / cancelled imports). */
export function locationFromStoredCoords(
  countryCode: string,
  stateName: string,
  cityName: string,
  lat: number,
  lng: number,
): ResolvedGooglePlacesLocation | null {
  const country = findGooglePlacesCountry(countryCode);
  if (!country) return null;
  return {
    countryCode: country.code,
    countryName: country.name,
    regionCode: country.regionCode,
    state: stateName.trim() || country.name,
    city: cityName.trim(),
    lat,
    lng,
  };
}

export function resolveGooglePlacesLocationFromProgress(
  countryCode: string,
  stateName: string,
  cityName: string,
  progress?: { locationLat?: number; locationLng?: number },
): ResolvedGooglePlacesLocation | null {
  const known = resolveKnownGooglePlacesLocation(countryCode, stateName, cityName);
  if (known) return known;

  if (
    typeof progress?.locationLat === 'number' &&
    typeof progress?.locationLng === 'number'
  ) {
    return locationFromStoredCoords(
      countryCode,
      stateName,
      cityName,
      progress.locationLat,
      progress.locationLng,
    );
  }

  return null;
}
