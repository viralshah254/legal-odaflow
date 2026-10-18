import { describe, expect, it } from "vitest"
import { findResearchCountry } from "./use-research-countries"
import type { CountryConfig } from "@/lib/api/config"

const SAMPLE_COUNTRIES: CountryConfig[] = [
  {
    code: "IN",
    name: "India",
    currency: "INR",
    supportedJurisdictions: ["Maharashtra", "Delhi"],
  },
  {
    code: "US",
    name: "United States",
    currency: "USD",
    supportedJurisdictions: ["California", "Federal"],
  },
]

describe("findResearchCountry", () => {
  it("finds country by ISO code regardless of case", () => {
    expect(findResearchCountry(SAMPLE_COUNTRIES, "in")?.name).toBe("India")
  })

  it("returns undefined for unknown country", () => {
    expect(findResearchCountry(SAMPLE_COUNTRIES, "FR")).toBeUndefined()
  })
})
