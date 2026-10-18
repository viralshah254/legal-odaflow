import { afterEach, describe, expect, it } from "vitest"
import { getDevGeoMock } from "./dev-geo-mock"

describe("getDevGeoMock", () => {
  const env = process.env

  afterEach(() => {
    process.env = { ...env }
  })

  it("returns null outside development", () => {
    process.env.NODE_ENV = "production"
    process.env.NEXT_PUBLIC_DEFAULT_COUNTRY = "KE"
    expect(getDevGeoMock()).toBeNull()
  })

  it("returns mock from DEV_GEO_COUNTRY in development", () => {
    process.env.NODE_ENV = "development"
    process.env.DEV_GEO_COUNTRY = "ke"
    process.env.DEV_GEO_REGION = "nai"
    expect(getDevGeoMock()).toEqual({ countryCode: "KE", regionCode: "NAI" })
  })

  it("falls back to NEXT_PUBLIC_DEFAULT_COUNTRY", () => {
    process.env.NODE_ENV = "development"
    delete process.env.DEV_GEO_COUNTRY
    delete process.env.DEV_GEO_REGION
    process.env.NEXT_PUBLIC_DEFAULT_COUNTRY = "IN"
    expect(getDevGeoMock()).toEqual({ countryCode: "IN", regionCode: null })
  })

  it("can be disabled with DEV_GEO_MOCK=false", () => {
    process.env.NODE_ENV = "development"
    process.env.DEV_GEO_MOCK = "false"
    process.env.NEXT_PUBLIC_DEFAULT_COUNTRY = "US"
    expect(getDevGeoMock()).toBeNull()
  })
})
