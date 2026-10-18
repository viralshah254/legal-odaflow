import { describe, expect, it } from "vitest"
import { resolvePricingCountry } from "./detect-pricing-country"

describe("resolvePricingCountry", () => {
  it("prefers Cloudflare visitor country over Vercel colo", async () => {
    const result = await resolvePricingCountry({
      cfIpCountry: "KE",
      vercelIpCountry: "NG",
    })
    expect(result).toEqual({ countryCode: "KE", source: "cf-ipcountry" })
  })

  it("uses Vercel when Cloudflare is absent", async () => {
    const result = await resolvePricingCountry({
      vercelIpCountry: "IN",
    })
    expect(result).toEqual({ countryCode: "IN", source: "vercel-ip-country" })
  })
})
