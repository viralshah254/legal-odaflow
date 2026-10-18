import { describe, expect, it } from "vitest"
import {
  formatJurisdictionLocation,
  hasJurisdictionMismatch,
  resolveJurisdictionChoice,
} from "./jurisdiction-mismatch"

describe("hasJurisdictionMismatch", () => {
  it("detects country-only mismatch", () => {
    expect(
      hasJurisdictionMismatch(
        { countryCode: "IN", region: "Maharashtra" },
        { countryCode: "KE", region: "Nairobi" },
      ),
    ).toBe(true)
  })

  it("detects same-country region mismatch when both regions are known", () => {
    expect(
      hasJurisdictionMismatch(
        { countryCode: "IN", region: "Maharashtra" },
        { countryCode: "IN", region: "Delhi" },
      ),
    ).toBe(true)
  })

  it("is false when countries match and one region is unknown", () => {
    expect(
      hasJurisdictionMismatch(
        { countryCode: "IN", region: "Maharashtra" },
        { countryCode: "IN", region: null },
      ),
    ).toBe(false)
  })

  it("is false when IP location is missing", () => {
    expect(
      hasJurisdictionMismatch({ countryCode: "IN", region: "Maharashtra" }, null),
    ).toBe(false)
  })

  it("is false when profile and IP agree", () => {
    expect(
      hasJurisdictionMismatch(
        { countryCode: "US", region: "California" },
        { countryCode: "US", region: "California" },
      ),
    ).toBe(false)
  })
})

describe("resolveJurisdictionChoice", () => {
  const profile = { countryCode: "IN", region: "Maharashtra" }
  const ip = { countryCode: "KE", region: "Nairobi" }

  it("maps profile choice to profile country and region", () => {
    expect(resolveJurisdictionChoice("profile", profile, ip)).toEqual({
      countryCode: "IN",
      region: "Maharashtra",
    })
  })

  it("maps IP choice to IP country and region", () => {
    expect(resolveJurisdictionChoice("ip", profile, ip)).toEqual({
      countryCode: "KE",
      region: "Nairobi",
    })
  })

  it("falls back to All regions when profile region is empty", () => {
    expect(
      resolveJurisdictionChoice(
        "profile",
        { countryCode: "IN", region: null },
        ip,
      ),
    ).toEqual({
      countryCode: "IN",
      region: "All regions",
    })
  })
})

describe("formatJurisdictionLocation", () => {
  it("formats country and region", () => {
    expect(formatJurisdictionLocation({ countryCode: "IN", region: "Maharashtra" })).toBe(
      "India · Maharashtra",
    )
  })

  it("formats country only for all-regions", () => {
    expect(formatJurisdictionLocation({ countryCode: "KE", region: "All regions" })).toBe(
      "Kenya",
    )
  })
})
