import { describe, expect, it } from "vitest"
import {
  getCityOptions,
  resolveDefaultCity,
} from "@/lib/geo/country-cities"

describe("getCityOptions", () => {
  it("includes Ahmedabad for Gujarat, India", () => {
    const cities = getCityOptions("IN", "Gujarat")
    expect(cities).toContain("Ahmedabad")
    expect(cities.length).toBeGreaterThan(10)
  })

  it("includes Kolkata for West Bengal, India", () => {
    const cities = getCityOptions("IN", "West Bengal")
    expect(cities).toContain("Kolkata")
  })

  it("matches curated Delhi (NCT) label to Delhi state cities", () => {
    const cities = getCityOptions("IN", "Delhi (NCT)")
    expect(cities.length).toBeGreaterThan(0)
  })

  it("returns US cities for California", () => {
    const cities = getCityOptions("US", "California")
    expect(cities.length).toBeGreaterThan(0)
  })
})

describe("resolveDefaultCity", () => {
  it("returns preferred city when it exists in the list", () => {
    expect(resolveDefaultCity("IN", "Gujarat", "Ahmedabad")).toBe("Ahmedabad")
  })

  it("falls back to first city alphabetically", () => {
    const city = resolveDefaultCity("IN", "Gujarat")
    expect(city).toBe(getCityOptions("IN", "Gujarat")[0])
  })

  it("returns preferred custom city when not in dataset", () => {
    expect(resolveDefaultCity("IN", "Gujarat", "Custom Town")).toBe("Custom Town")
  })
})
