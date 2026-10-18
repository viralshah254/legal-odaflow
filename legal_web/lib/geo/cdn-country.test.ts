import { describe, expect, it } from "vitest"
import { resolveCdnCountry } from "./cdn-country"

describe("resolveCdnCountry", () => {
  it("prefers Cloudflare visitor country over a disagreeing Vercel colo header", () => {
    const result = resolveCdnCountry({
      cfIpCountry: "KE",
      cfRegion: "30",
      vercelIpCountry: "NG",
      vercelRegion: "LA",
    })
    expect(result).toEqual({
      countryCode: "KE",
      regionCode: "30",
      source: "cf-ipcountry",
    })
  })

  it("uses Vercel when Cloudflare is absent", () => {
    const result = resolveCdnCountry({
      vercelIpCountry: "IN",
      vercelRegion: "MH",
    })
    expect(result).toEqual({
      countryCode: "IN",
      regionCode: "MH",
      source: "vercel-ip-country",
    })
  })

  it("ignores Cloudflare XX / T1 so Vercel can still win", () => {
    const result = resolveCdnCountry({
      cfIpCountry: "XX",
      vercelIpCountry: "GB",
    })
    expect(result?.countryCode).toBe("GB")
    expect(result?.source).toBe("vercel-ip-country")
  })

  it("uses CloudFront when neither Cloudflare nor Vercel is present", () => {
    expect(
      resolveCdnCountry({ cloudfrontCountry: "US" }),
    ).toEqual({
      countryCode: "US",
      regionCode: null,
      source: "cloudfront-viewer-country",
    })
  })
})
