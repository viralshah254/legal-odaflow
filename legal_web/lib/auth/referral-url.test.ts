import { describe, it, expect, beforeEach, vi } from "vitest"

// Mock environment so getAppUrl returns a predictable value
vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://umbrella.okaylegal.ai")

import { buildReferralShareUrl } from "@/lib/app-url"
import { appendReferralToHref, persistReferralCode, clearPersistedReferralCode } from "@/lib/auth/referral-storage"

describe("buildReferralShareUrl", () => {
  it("points to the landing page root", () => {
    const url = buildReferralShareUrl("57RZRBTD")
    expect(url).toMatch(/^https:\/\/umbrella\.okaylegal\.ai\/\?ref=/)
  })

  it("includes the uppercased code as ?ref=", () => {
    expect(buildReferralShareUrl("abcdef")).toBe(
      "https://umbrella.okaylegal.ai/?ref=ABCDEF",
    )
  })

  it("does not point to /auth", () => {
    expect(buildReferralShareUrl("CODE")).not.toContain("/auth")
  })
})

describe("appendReferralToHref", () => {
  beforeEach(() => {
    clearPersistedReferralCode()
  })

  it("returns href unchanged when no ref is stored", () => {
    expect(appendReferralToHref("/auth?redirect=/app/research")).toBe(
      "/auth?redirect=/app/research",
    )
  })

  it("appends stored ref to a plain path", () => {
    persistReferralCode("TESTCODE")
    expect(appendReferralToHref("/auth")).toBe("/auth?ref=TESTCODE")
  })

  it("appends stored ref alongside existing query params", () => {
    persistReferralCode("TESTCODE")
    const result = appendReferralToHref("/auth?redirect=%2Fapp%2Fresearch")
    expect(result).toContain("ref=TESTCODE")
    expect(result).toContain("redirect=")
  })
})
