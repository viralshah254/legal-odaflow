import { REQUEST_TIMEOUT_MS } from './discovery.config';

const PLACES_NEW_BASE = 'https://places.googleapis.com/v1';

const SEARCH_FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.types',
  'places.nationalPhoneNumber',
  'places.internationalPhoneNumber',
  'places.websiteUri',
  'places.googleMapsUri',
  'nextPageToken',
].join(',');

const PLACE_DETAIL_MASK = [
  'id',
  'displayName',
  'formattedAddress',
  'types',
  'nationalPhoneNumber',
  'internationalPhoneNumber',
  'websiteUri',
  'googleMapsUri',
].join(',');

export interface PlacesNewPlace {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  types?: string[];
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  googleMapsUri?: string;
}

export interface PlacesNewSearchResult {
  places: PlacesNewPlace[];
  apiCalls: number;
}

export function placeIdFromResourceName(resourceId?: string): string | null {
  if (!resourceId) return null;
  const prefix = 'places/';
  return resourceId.startsWith(prefix) ? resourceId.slice(prefix.length) : resourceId;
}

export function displayNameFromPlace(place: PlacesNewPlace): string | null {
  return place.displayName?.text?.trim() || null;
}

export function phoneFromPlace(place: PlacesNewPlace): string | null {
  return place.internationalPhoneNumber ?? place.nationalPhoneNumber ?? null;
}

export type PlacesSearchLocationBias = {
  lat: number;
  lng: number;
  /** Search radius in metres (default 50 km). */
  radiusM?: number;
};

export class GooglePlacesNewClient {
  async searchText(
    apiKey: string,
    textQuery: string,
    regionCode: string,
    locationBias?: PlacesSearchLocationBias,
  ): Promise<PlacesNewSearchResult> {
    let pageToken: string | undefined;
    const places: PlacesNewPlace[] = [];
    let apiCalls = 0;

    do {
      apiCalls += 1;
      const body: Record<string, unknown> = {
        textQuery,
        regionCode: regionCode.toUpperCase(),
        pageSize: 20,
        // Do not set includedType to "lawyer" — Table B types are invalid here (HTTP 400).
        // Legal filtering is applied client-side after search.
      };
      if (locationBias) {
        body.locationBias = {
          circle: {
            center: {
              latitude: locationBias.lat,
              longitude: locationBias.lng,
            },
            radius: locationBias.radiusM ?? 50_000,
          },
        };
      }
      if (pageToken) body.pageToken = pageToken;

      const data = await this.postJson<{
        places?: PlacesNewPlace[];
        nextPageToken?: string;
        error?: { message?: string; status?: string };
      }>(`${PLACES_NEW_BASE}/places:searchText`, apiKey, SEARCH_FIELD_MASK, body);

      if (data.error?.message) {
        throw new Error(`Places New searchText: ${data.error.message}`);
      }

      places.push(...(data.places ?? []));
      pageToken = data.nextPageToken;
      if (pageToken) await this.sleep(2100);
    } while (pageToken && places.length < 60);

    return { places, apiCalls };
  }

  async searchNearby(
    apiKey: string,
    lat: number,
    lng: number,
    radiusM: number,
  ): Promise<PlacesNewSearchResult> {
    let pageToken: string | undefined;
    const places: PlacesNewPlace[] = [];
    let apiCalls = 0;

    do {
      apiCalls += 1;
      const body: Record<string, unknown> = {
        // No includedTypes — "lawyer" is Table B and invalid for Nearby (New) filters.
        maxResultCount: 20,
        locationRestriction: {
          circle: {
            center: { latitude: lat, longitude: lng },
            radius: radiusM,
          },
        },
      };
      if (pageToken) body.pageToken = pageToken;

      const data = await this.postJson<{
        places?: PlacesNewPlace[];
        nextPageToken?: string;
        error?: { message?: string };
      }>(`${PLACES_NEW_BASE}/places:searchNearby`, apiKey, SEARCH_FIELD_MASK, body);

      if (data.error?.message) {
        throw new Error(`Places New searchNearby: ${data.error.message}`);
      }

      places.push(...(data.places ?? []));
      pageToken = data.nextPageToken;
      if (pageToken) await this.sleep(2100);
    } while (pageToken && places.length < 60);

    return { places, apiCalls };
  }

  /** Fallback when search response lacks phone/website (billed as Place Details). */
  async getPlace(apiKey: string, placeId: string): Promise<PlacesNewPlace | null> {
    const resource = placeId.startsWith('places/') ? placeId : `places/${placeId}`;
    try {
      const data = await this.getJson<PlacesNewPlace>(
        `${PLACES_NEW_BASE}/${resource}`,
        apiKey,
        PLACE_DETAIL_MASK,
      );
      return data;
    } catch {
      return null;
    }
  }

  private async postJson<T>(
    url: string,
    apiKey: string,
    fieldMask: string,
    body: Record<string, unknown>,
  ): Promise<T> {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': fieldMask,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Places New HTTP ${resp.status}: ${text.slice(0, 200)}`);
    }
    return resp.json() as Promise<T>;
  }

  private async getJson<T>(url: string, apiKey: string, fieldMask: string): Promise<T> {
    const resp = await fetch(url, {
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': fieldMask,
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!resp.ok) {
      throw new Error(`Places New HTTP ${resp.status}`);
    }
    return resp.json() as Promise<T>;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
