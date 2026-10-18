import { afterEach, describe, expect, it, vi } from "vitest"
import { detectFromIpGeo, firstPublicIp, isPrivateOrLocalIp, readClientIp } from "./ip-api"

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("isPrivateOrLocalIp", () => {
  it("flags localhost and private ranges", () => {
    expect(isPrivateOrLocalIp("127.0.0.1")).toBe(true)
    expect(isPrivateOrLocalIp("::1")).toBe(true)
    expect(isPrivateOrLocalIp("192.168.1.5")).toBe(true)
    expect(isPrivateOrLocalIp("10.0.0.2")).toBe(true)
  })

  it("allows public IPs", () => {
    expect(isPrivateOrLocalIp("8.8.8.8")).toBe(false)
  })

  it("treats IPv6-mapped loopback as private", () => {
    expect(isPrivateOrLocalIp("::ffff:127.0.0.1")).toBe(true)
    expect(isPrivateOrLocalIp("::ffff:10.0.0.2")).toBe(true)
    expect(isPrivateOrLocalIp("::ffff:8.8.8.8")).toBe(false)
  })
})

describe("firstPublicIp", () => {
  it("skips a private first hop and uses the next public IP", () => {
    expect(firstPublicIp("10.0.0.2, 8.8.8.8, 1.1.1.1")).toBe("8.8.8.8")
  })
})

describe("readClientIp", () => {
  it("prefers cf-connecting-ip over x-forwarded-for", () => {
    const headers = new Headers({
      "cf-connecting-ip": "102.0.1.20",
      "x-forwarded-for": "10.0.0.2, 102.0.1.20",
      "x-real-ip": "10.0.0.2",
    })
    expect(readClientIp(headers)).toBe("102.0.1.20")
  })

  it("uses the first public x-forwarded-for hop when CF is absent", () => {
    const headers = new Headers({
      "x-forwarded-for": "192.168.1.8, 41.90.1.10",
    })
    expect(readClientIp(headers)).toBe("41.90.1.10")
  })
})

describe("detectFromIpGeo", () => {
  it("looks up the provided public client IP", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        country_code: "IN",
        region_code: "GJ",
        region: "Gujarat",
      }),
    })
    vi.stubGlobal("fetch", fetchMock)

    const result = await detectFromIpGeo("8.8.8.8")
    expect(result?.countryCode).toBe("IN")
    expect(result?.regionName).toBe("Gujarat")
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("8.8.8.8"),
      expect.any(Object),
    )
  })

  it("uses egress lookup when client IP is private/localhost", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        country_code: "KE",
        region_code: "30",
        region: "Nairobi City",
      }),
    })
    vi.stubGlobal("fetch", fetchMock)

    const result = await detectFromIpGeo("127.0.0.1")
    expect(result?.countryCode).toBe("KE")
    expect(result?.regionName).toBe("Nairobi City")
    expect(fetchMock).toHaveBeenCalledWith(
      "https://ipapi.co/json/",
      expect.any(Object),
    )
  })

  it("uses egress lookup when no client IP is provided", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        country_code: "KE",
        region_code: "30",
        region: "Nairobi City",
      }),
    })
    vi.stubGlobal("fetch", fetchMock)

    const result = await detectFromIpGeo()
    expect(result?.countryCode).toBe("KE")
    expect(fetchMock).toHaveBeenCalledWith(
      "https://ipapi.co/json/",
      expect.any(Object),
    )
  })

  it("returns null when egress providers fail", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false })
    vi.stubGlobal("fetch", fetchMock)

    await expect(detectFromIpGeo("127.0.0.1")).resolves.toBeNull()
  })

  it("does not use egress lookup in production", async () => {
    const previous = process.env.NODE_ENV
    process.env.NODE_ENV = "production"
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    try {
      await expect(detectFromIpGeo("127.0.0.1")).resolves.toBeNull()
      expect(fetchMock).not.toHaveBeenCalled()
    } finally {
      process.env.NODE_ENV = previous
    }
  })
})
