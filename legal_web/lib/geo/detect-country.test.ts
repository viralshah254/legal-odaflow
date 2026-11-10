import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  detectCountry,
  detectIpLocation,
  getStoredCountryIfConfirmed,
  isUserConfirmedCountry,
  persistCountrySelection,
  resolveAccountCountryCode,
  resolveWorkspaceCountryCode,
} from "@/lib/geo/detect-country"

const COUNTRY_STORAGE_KEY = "odaflow_detected_country"

describe("resolveAccountCountryCode", () => {
  it("prefers user profile country over tenant primary country", () => {
    expect(resolveAccountCountryCode("US", "IN")).toBe("US")
  })

  it("falls back to tenant primary country when user country is missing", () => {
    expect(resolveAccountCountryCode(null, "IN")).toBe("IN")
    expect(resolveAccountCountryCode("", "IN")).toBe("IN")
  })

  it("returns empty string when neither is set", () => {
    expect(resolveAccountCountryCode(null, null)).toBe("")
  })
})

describe("resolveWorkspaceCountryCode", () => {
  it("uses current location for new work while travelling, with account as fallback", () => {
    expect(resolveWorkspaceCountryCode({ currentLocation: "KE", tenantPrimary: "IN", profile: "IN" })).toBe("KE")
    expect(resolveWorkspaceCountryCode({ confirmedOverride: "GB", currentLocation: "KE", tenantPrimary: "IN" })).toBe("KE")
    expect(resolveWorkspaceCountryCode({ currentLocation: "ZZ", tenantPrimary: "IN" })).toBe("IN")
  })
  it("uses India tenant over a stale US profile for chrome", () => {
    expect(
      resolveWorkspaceCountryCode({ tenantPrimary: "IN", profile: "US" }),
    ).toBe("IN")
  })

  it("uses tenant when profile is missing", () => {
    expect(resolveWorkspaceCountryCode({ tenantPrimary: "KE", profile: null })).toBe("KE")
  })

  it("uses profile when there is no tenant", () => {
    expect(resolveWorkspaceCountryCode({ tenantPrimary: null, profile: "GB" })).toBe("GB")
  })

  it("lets an explicit confirmed pick beat tenant and profile", () => {
    expect(
      resolveWorkspaceCountryCode({
        confirmedOverride: "US",
        tenantPrimary: "IN",
        profile: "IN",
      }),
    ).toBe("US")
  })

  it("returns empty when nothing is set so callers can fall back to IN", () => {
    expect(resolveWorkspaceCountryCode({ tenantPrimary: null, profile: null })).toBe("")
  })
})

describe("user-confirmed country override", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("tracks manual country selection with a confirmed flag", () => {
    persistCountrySelection("FR", { userConfirmed: true })
    expect(localStorage.getItem(COUNTRY_STORAGE_KEY)).toBe("FR")
    expect(isUserConfirmedCountry()).toBe(true)
    expect(getStoredCountryIfConfirmed()).toBe("FR")
  })

  it("does not treat auto-detected storage as a confirmed override", () => {
    persistCountrySelection("FR")
    expect(isUserConfirmedCountry()).toBe(false)
    expect(getStoredCountryIfConfirmed()).toBeNull()
  })

  it("returns confirmed override ahead of account defaults in helper", () => {
    persistCountrySelection("FR", { userConfirmed: true })
    const account = resolveAccountCountryCode("IN", "IN")
    expect(getStoredCountryIfConfirmed() ?? account).toBe("FR")
  })
})

describe("guest vs authenticated resolution priority", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("uses account country when no confirmed override exists", () => {
    const account = resolveAccountCountryCode("IN", "IN")
    const confirmed = getStoredCountryIfConfirmed()
    expect(confirmed ?? account).toBe("IN")
  })

  it("simulates locale fallback losing to account country for signed-in users", () => {
    const localeFallback = "FR"
    const account = resolveAccountCountryCode("IN", "IN")
    const confirmed = getStoredCountryIfConfirmed()
    const signedInCountry = confirmed ?? account
    expect(signedInCountry).toBe("IN")
    expect(signedInCountry).not.toBe(localeFallback)
  })

  it("simulates guest defaulting to IN when geo and account are unavailable", () => {
    const account = resolveAccountCountryCode(null, null)
    expect(account).toBe("")
    const guestCountry = account || "IN"
    expect(guestCountry).toBe("IN")
  })
})

describe("detectCountry", () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal("navigator", {
      language: "fr-FR",
      languages: ["fr-FR"],
    })
    vi.stubGlobal("fetch", vi.fn())
  })

  it("uses IP geo when /api/geo returns IN", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ countryCode: "IN", regionCode: "MH" }),
    } as Response)

    const result = await detectCountry()
    expect(result.countryCode).toBe("IN")
    expect(result.source).toBe("ip")
    expect(localStorage.getItem(COUNTRY_STORAGE_KEY)).toBeNull()
    expect(isUserConfirmedCountry()).toBe(false)
    expect(fetch).toHaveBeenCalledWith(
      "/api/geo/",
      expect.objectContaining({
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      }),
    )
  })

  it("prefers user-confirmed storage over IP geo", async () => {
    persistCountrySelection("FR", { userConfirmed: true })
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ countryCode: "IN", regionCode: "MH" }),
    } as Response)

    const result = await detectCountry({ preferStored: true })

    expect(result.countryCode).toBe("FR")
    expect(result.source).toBe("stored")
    expect(fetch).not.toHaveBeenCalled()
  })

  it("uses physical location when account country disagrees", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ countryCode: "SG", regionCode: null }),
    } as Response)

    const result = await detectCountry({ accountCountryCode: "IN" })

    expect(result.countryCode).toBe("SG")
    expect(result.source).toBe("ip")
    expect(result.region).toBeUndefined()
  })

  it("uses IP region when IP country matches account country", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ countryCode: "IN", regionCode: "MH" }),
    } as Response)

    const result = await detectCountry({ accountCountryCode: "IN" })

    expect(result.countryCode).toBe("IN")
    expect(result.region).toBe("Maharashtra")
    expect(result.source).toBe("ip")
  })

  it("leaves jurisdiction unresolved when geo fails, without inferring law from device locale", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false } as Response)

    const result = await detectCountry()
    expect(result.countryCode).toBe("")
    expect(result.source).toBe("default")
  })

  it("uses user-confirmed storage when IP geo fails", async () => {
    persistCountrySelection("US", { userConfirmed: true })
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ countryCode: null }),
    } as Response)

    const result = await detectCountry()
    expect(result.countryCode).toBe("US")
    expect(result.source).toBe("stored")
  })

  it("does not use unconfirmed storage when IP geo fails", async () => {
    persistCountrySelection("FR")
    vi.mocked(fetch).mockResolvedValue({ ok: false } as Response)

    const result = await detectCountry()
    expect(result.countryCode).toBe("")
    expect(result.source).toBe("default")
  })
})

describe("detectIpLocation", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn())
  })

  it("returns real IP geo from /api/geo", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        countryCode: "KE",
        regionCode: "30",
        regionName: "Nairobi City",
        source: "ip-geo",
      }),
    } as Response)

    const result = await detectIpLocation()
    expect(result?.countryCode).toBe("KE")
    expect(result?.region).toBeTruthy()
  })

  it("ignores invented default/none sources so mismatch UI stays honest", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        countryCode: "IN",
        regionCode: null,
        source: "default",
      }),
    } as Response)

    await expect(detectIpLocation()).resolves.toBeNull()
  })

  it("ignores XX unknown country", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        countryCode: "XX",
        source: "none",
      }),
    } as Response)

    await expect(detectIpLocation()).resolves.toBeNull()
  })

  it("ignores server-egress IP geo so mismatch UI stays honest", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        countryCode: "NG",
        regionCode: null,
        source: "ip-geo",
        via: "egress",
      }),
    } as Response)

    await expect(detectIpLocation()).resolves.toBeNull()
  })
})
