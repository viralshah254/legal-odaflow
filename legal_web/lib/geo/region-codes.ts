/**
 * Maps ISO 3166-2 subdivision codes (as returned by Vercel's
 * x-vercel-ip-country-region header) to the display names used in
 * COUNTRY_STATES / US_JURISDICTIONS.
 *
 * Keys are upper-case subdivision codes (without the country prefix).
 */
export const REGION_CODE_TO_NAME: Record<string, Record<string, string>> = {
  IN: {
    AP: "Andhra Pradesh",
    AR: "Arunachal Pradesh",
    AS: "Assam",
    BR: "Bihar",
    CG: "Chhattisgarh",
    GA: "Goa",
    GJ: "Gujarat",
    HR: "Haryana",
    HP: "Himachal Pradesh",
    JH: "Jharkhand",
    KA: "Karnataka",
    KL: "Kerala",
    MP: "Madhya Pradesh",
    MH: "Maharashtra",
    MN: "Manipur",
    ML: "Meghalaya",
    MZ: "Mizoram",
    NL: "Nagaland",
    OR: "Odisha",
    PB: "Punjab",
    RJ: "Rajasthan",
    SK: "Sikkim",
    TN: "Tamil Nadu",
    TS: "Telangana",
    TR: "Tripura",
    UP: "Uttar Pradesh",
    UT: "Uttarakhand",
    WB: "West Bengal",
    AN: "Andaman and Nicobar Islands",
    CH: "Chandigarh",
    DH: "Dadra and Nagar Haveli and Daman and Diu",
    DL: "Delhi (NCT)",
    JK: "Jammu & Kashmir",
    LA: "Ladakh",
    LD: "Lakshadweep",
    PY: "Puducherry",
  },
  US: {
    AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
    CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
    HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
    KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
    MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi",
    MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire",
    NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina",
    ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
    RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee",
    TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington",
    WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming", DC: "Washington D.C.",
  },
  GB: {
    ENG: "England", SCT: "Scotland", WLS: "Wales", NIR: "Northern Ireland",
    LND: "London",
  },
  KE: {
    // Vercel uses numeric or abbreviated county codes for Kenya
    // Most common ones:
    "047": "Nairobi", NAI: "Nairobi",
    "022": "Mombasa", MBA: "Mombasa",
    "031": "Nakuru", NKR: "Nakuru",
    "030": "Kisumu", KSM: "Kisumu",
  },
  AU: {
    ACT: "Australian Capital Territory",
    NSW: "New South Wales",
    NT: "Northern Territory",
    QLD: "Queensland",
    SA: "South Australia",
    TAS: "Tasmania",
    VIC: "Victoria",
    WA: "Western Australia",
  },
  CA: {
    AB: "Alberta", BC: "British Columbia", MB: "Manitoba", NB: "New Brunswick",
    NL: "Newfoundland and Labrador", NT: "Northwest Territories", NS: "Nova Scotia",
    NU: "Nunavut", ON: "Ontario", PE: "Prince Edward Island", QC: "Quebec",
    SK: "Saskatchewan", YT: "Yukon",
  },
}

/**
 * Resolves an ISO 3166-2 region code to its display name used in the
 * COUNTRY_STATES dropdowns, or returns null if not found.
 *
 * @param countryCode  ISO 3166-1 alpha-2 (e.g. "IN")
 * @param regionCode   ISO 3166-2 subdivision code without country prefix (e.g. "MH")
 */
export function resolveRegionName(
  countryCode: string,
  regionCode: string | null | undefined,
): string | null {
  if (!regionCode) return null
  const map = REGION_CODE_TO_NAME[countryCode.toUpperCase()]
  if (!map) return null
  return map[regionCode.toUpperCase()] ?? null
}
