import { describe, expect, it } from "vitest"
import { matchRegionToJurisdictionList, matchRegionToStateOption, resolveGeoJurisdiction } from "./country-states"

const IN_BACKEND_JURISDICTIONS = [
  "Delhi",
  "Maharashtra",
  "Karnataka",
  "Tamil Nadu",
  "West Bengal",
  "Gujarat",
]

describe("matchRegionToJurisdictionList", () => {
  it("maps IP region names to backend jurisdiction labels", () => {
    expect(matchRegionToJurisdictionList(IN_BACKEND_JURISDICTIONS, "Maharashtra")).toBe(
      "Maharashtra",
    )
  })

  it("maps Nairobi aliases against backend Kenya list", () => {
    expect(
      matchRegionToJurisdictionList(["Nairobi", "Mombasa"], "Nairobi City"),
    ).toBe("Nairobi")
  })

  it("returns null when region is not in backend list", () => {
    expect(matchRegionToJurisdictionList(IN_BACKEND_JURISDICTIONS, "Kerala")).toBeNull()
  })
})

describe("resolveGeoJurisdiction", () => {
  it("maps Indian ISO region code MH to Maharashtra", () => {
    expect(resolveGeoJurisdiction("IN", "MH", null)).toBe("Maharashtra")
  })

  it("maps ipapi region name to dropdown option", () => {
    expect(resolveGeoJurisdiction("IN", null, "Maharashtra")).toBe("Maharashtra")
  })

  it("maps US state code CA to California", () => {
    expect(resolveGeoJurisdiction("US", "CA", "California")).toBe("California")
  })

  it("maps Delhi aliases", () => {
    expect(matchRegionToStateOption("IN", "National Capital Territory of Delhi")).toBe(
      "Delhi (NCT)",
    )
  })
})
