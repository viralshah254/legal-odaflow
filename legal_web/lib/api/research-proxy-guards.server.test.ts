import { afterEach, describe, expect, it } from "vitest"
import { NextRequest } from "next/server"
import {
  MAX_RESEARCH_BODY_BYTES,
  RESEARCH_RATE_LIMIT,
  checkResearchRateLimit,
  getResearchProxyClientKey,
  resetResearchRateLimitForTests,
} from "./research-proxy-guards.server"

describe("research-proxy-guards", () => {
  afterEach(() => {
    resetResearchRateLimitForTests()
  })

  it("derives client key from x-forwarded-for", () => {
    const req = new NextRequest("http://localhost/api/v1/ai/research/", {
      headers: { "x-forwarded-for": "203.0.113.1, 10.0.0.1" },
    })
    expect(getResearchProxyClientKey(req)).toBe("203.0.113.1")
  })

  it("allows requests under the rate limit", () => {
    const now = Date.now()
    for (let i = 0; i < RESEARCH_RATE_LIMIT.limit; i += 1) {
      expect(checkResearchRateLimit("client-a", now).allowed).toBe(true)
    }
  })

  it("blocks requests after the rate limit threshold", () => {
    const now = Date.now()
    for (let i = 0; i < RESEARCH_RATE_LIMIT.limit; i += 1) {
      checkResearchRateLimit("client-b", now)
    }

    const blocked = checkResearchRateLimit("client-b", now)
    expect(blocked.allowed).toBe(false)
    if (!blocked.allowed) {
      expect(blocked.retryAfterSec).toBeGreaterThan(0)
    }
  })

  it("documents the research body size cap", () => {
    expect(MAX_RESEARCH_BODY_BYTES).toBe(64 * 1024)
  })
})
