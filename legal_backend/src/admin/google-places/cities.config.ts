export interface GooglePlacesCityEntry {
  name: string;
  lat: number;
  lng: number;
}

export interface GooglePlacesStateEntry {
  name: string;
  cities: GooglePlacesCityEntry[];
}

export interface GooglePlacesCountryEntry {
  code: string;
  name: string;
  /** Google Places API region bias (ISO 3166-1 alpha-2, lowercase). */
  regionCode: string;
  states: GooglePlacesStateEntry[];
}

/** Countries supported for Google Places prospect scraping. */
export const GOOGLE_PLACES_COUNTRIES: GooglePlacesCountryEntry[] = [
  {
    code: 'IN',
    name: 'India',
    regionCode: 'in',
    states: [
      { name: 'Andhra Pradesh', cities: [] },
      { name: 'Arunachal Pradesh', cities: [] },
      { name: 'Assam', cities: [] },
      { name: 'Bihar', cities: [] },
      { name: 'Chhattisgarh', cities: [] },
      {
        name: 'Delhi',
        cities: [{ name: 'Delhi', lat: 28.7041, lng: 77.1025 }],
      },
      { name: 'Goa', cities: [] },
      {
        name: 'Gujarat',
        cities: [
          { name: 'Ahmedabad', lat: 23.0225, lng: 72.5714 },
          { name: 'Surat', lat: 21.1702, lng: 72.8311 },
          { name: 'Vadodara', lat: 22.3072, lng: 73.1812 },
          { name: 'Rajkot', lat: 22.3039, lng: 70.8022 },
          { name: 'Gandhinagar', lat: 23.2156, lng: 72.6369 },
          { name: 'Bhavnagar', lat: 21.7645, lng: 72.1519 },
        ],
      },
      { name: 'Haryana', cities: [] },
      { name: 'Himachal Pradesh', cities: [] },
      {
        name: 'Karnataka',
        cities: [{ name: 'Bangalore', lat: 12.9716, lng: 77.5946 }],
      },
      { name: 'Kerala', cities: [] },
      { name: 'Madhya Pradesh', cities: [] },
      {
        name: 'Maharashtra',
        cities: [
          { name: 'Mumbai', lat: 19.076, lng: 72.8777 },
          { name: 'Pune', lat: 18.5204, lng: 73.8567 },
        ],
      },
      { name: 'Manipur', cities: [] },
      { name: 'Meghalaya', cities: [] },
      { name: 'Mizoram', cities: [] },
      { name: 'Nagaland', cities: [] },
      { name: 'Odisha', cities: [] },
      { name: 'Punjab', cities: [] },
      {
        name: 'Rajasthan',
        cities: [{ name: 'Jaipur', lat: 26.9124, lng: 75.7873 }],
      },
      { name: 'Sikkim', cities: [] },
      {
        name: 'Tamil Nadu',
        cities: [{ name: 'Chennai', lat: 13.0827, lng: 80.2707 }],
      },
      {
        name: 'Telangana',
        cities: [{ name: 'Hyderabad', lat: 17.385, lng: 78.4867 }],
      },
      { name: 'Tripura', cities: [] },
      {
        name: 'Uttar Pradesh',
        cities: [{ name: 'Lucknow', lat: 26.8467, lng: 80.9462 }],
      },
      { name: 'Uttarakhand', cities: [] },
      {
        name: 'West Bengal',
        cities: [{ name: 'Kolkata', lat: 22.5726, lng: 88.3639 }],
      },
      { name: 'Jammu and Kashmir', cities: [] },
      { name: 'Ladakh', cities: [] },
      { name: 'Chandigarh', cities: [] },
      { name: 'Puducherry', cities: [] },
    ],
  },
  {
    code: 'US',
    name: 'United States',
    regionCode: 'us',
    states: [
      { name: 'California', cities: [] },
      { name: 'New York', cities: [] },
      { name: 'Texas', cities: [] },
      { name: 'Florida', cities: [] },
      { name: 'Illinois', cities: [] },
      { name: 'Washington', cities: [] },
      { name: 'Massachusetts', cities: [] },
      { name: 'District of Columbia', cities: [] },
    ],
  },
  {
    code: 'GB',
    name: 'United Kingdom',
    regionCode: 'gb',
    states: [
      { name: 'England', cities: [] },
      { name: 'Scotland', cities: [] },
      { name: 'Wales', cities: [] },
      { name: 'Northern Ireland', cities: [] },
    ],
  },
  {
    code: 'CA',
    name: 'Canada',
    regionCode: 'ca',
    states: [
      { name: 'Ontario', cities: [] },
      { name: 'Quebec', cities: [] },
      { name: 'British Columbia', cities: [] },
      { name: 'Alberta', cities: [] },
    ],
  },
  {
    code: 'AU',
    name: 'Australia',
    regionCode: 'au',
    states: [
      { name: 'New South Wales', cities: [] },
      { name: 'Victoria', cities: [] },
      { name: 'Queensland', cities: [] },
      { name: 'Western Australia', cities: [] },
    ],
  },
  {
    code: 'SG',
    name: 'Singapore',
    regionCode: 'sg',
    states: [{ name: 'Singapore', cities: [] }],
  },
  {
    code: 'AE',
    name: 'United Arab Emirates',
    regionCode: 'ae',
    states: [
      { name: 'Dubai', cities: [] },
      { name: 'Abu Dhabi', cities: [] },
    ],
  },
];

/** @deprecated alias */
export const GOOGLE_PLACES_LOCATIONS = GOOGLE_PLACES_COUNTRIES;

export interface ResolvedGooglePlacesLocation {
  countryCode: string;
  countryName: string;
  regionCode: string;
  state: string;
  city: string;
  lat: number;
  lng: number;
}

export function findGooglePlacesCountry(code: string): GooglePlacesCountryEntry | null {
  const trimmed = code.trim().toUpperCase();
  return GOOGLE_PLACES_COUNTRIES.find((c) => c.code === trimmed) ?? null;
}

function findState(country: GooglePlacesCountryEntry, stateName: string): GooglePlacesStateEntry | null {
  const lower = stateName.trim().toLowerCase();
  return country.states.find((s) => s.name.toLowerCase() === lower) ?? null;
}

function findCity(state: GooglePlacesStateEntry, cityName: string): GooglePlacesCityEntry | null {
  const lower = cityName.trim().toLowerCase();
  return state.cities.find((c) => c.name.toLowerCase() === lower) ?? null;
}

/** Lookup from the built-in catalog only (no geocoding). */
export function resolveKnownGooglePlacesLocation(
  countryCode: string,
  stateName: string,
  cityName: string,
): ResolvedGooglePlacesLocation | null {
  const country = findGooglePlacesCountry(countryCode);
  if (!country) return null;

  const stateTrimmed = stateName.trim();
  const cityTrimmed = cityName.trim();
  if (!cityTrimmed) return null;

  const state = stateTrimmed ? findState(country, stateTrimmed) : null;
  if (state) {
    const city = findCity(state, cityTrimmed);
    if (city) {
      return {
        countryCode: country.code,
        countryName: country.name,
        regionCode: country.regionCode,
        state: state.name,
        city: city.name,
        lat: city.lat,
        lng: city.lng,
      };
    }
  }

  // Match city name across all states in the country (e.g. Delhi state/city).
  for (const st of country.states) {
    const city = findCity(st, cityTrimmed);
    if (city) {
      return {
        countryCode: country.code,
        countryName: country.name,
        regionCode: country.regionCode,
        state: st.name,
        city: city.name,
        lat: city.lat,
        lng: city.lng,
      };
    }
  }

  return null;
}

/** @deprecated Use resolveKnownGooglePlacesLocation or location-resolver.resolveGooglePlacesLocation */
export function resolveGooglePlacesLocation(
  countryCode: string,
  stateName: string,
  cityName: string,
): ResolvedGooglePlacesLocation | null {
  return resolveKnownGooglePlacesLocation(countryCode, stateName, cityName);
}

export function listGooglePlacesCountryCodes(): string[] {
  return GOOGLE_PLACES_COUNTRIES.map((c) => c.code);
}

export function listGooglePlacesCityNames(): string[] {
  const names: string[] = [];
  for (const country of GOOGLE_PLACES_COUNTRIES) {
    for (const state of country.states) {
      for (const city of state.cities) {
        names.push(city.name);
      }
    }
  }
  return names;
}

export function getGooglePlacesLocationTree() {
  return GOOGLE_PLACES_COUNTRIES.map((country) => ({
    code: country.code,
    name: country.name,
    states: country.states.map((state) => ({
      name: state.name,
      cities: state.cities.map((city) => city.name),
    })),
  }));
}

export function parseGooglePlacesSourceSummary(sourceSummary: string | null | undefined) {
  if (!sourceSummary?.startsWith('google_places:')) return null;
  const parts = sourceSummary.split(':');
  if (parts.length < 4) return null;
  return {
    countryCode: parts[1],
    state: parts[2],
    city: parts[3],
  };
}
