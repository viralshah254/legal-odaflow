import { describe, expect, it } from "vitest"
import {
  countryFlag,
  countryFlagLabel,
  isSectionFinderCountry,
  sectionFinderCountryParam,
} from "@/lib/geo/country-flag"

describe("countryFlag", () => {
  it("returns the flag for supported countries and nothing while empty", () => {
    expect(countryFlag("IN")).toBe("🇮🇳")
    expect(countryFlag("US")).toBe("🇺🇸")
    expect(countryFlag("KE")).toBe("🇰🇪")
    expect(countryFlag("GB")).toBe("🇬🇧")
    expect(countryFlag("")).toBeUndefined()
    expect(countryFlag(null)).toBeUndefined()
  })

  it("does not treat unknown codes as the United States", () => {
    expect(countryFlag("FR")).toBeUndefined()
    expect(countryFlagLabel("IN")).toBe("India")
  })
})

describe("sectionFinderCountryParam", () => {
  it("omits the query until a supported workspace country exists", () => {
    expect(sectionFinderCountryParam("")).toBeNull()
    expect(sectionFinderCountryParam("IN")).toBe("IN")
    expect(isSectionFinderCountry("US")).toBe(true)
    expect(isSectionFinderCountry("")).toBe(false)
  })
})
