import { describe, expect, it } from "vitest"
import {
  buildContentSecurityPolicy,
  getContentSecurityPolicyHeader,
  getStrictTransportSecurityHeader,
} from "./content-security-policy.js"

describe("buildContentSecurityPolicy", () => {
  it("returns null for Electron builds", () => {
    expect(buildContentSecurityPolicy({ ELECTRON: "true" })).toBeNull()
  })

  it("includes self and Stripe hosts", () => {
    const policy = buildContentSecurityPolicy({ NODE_ENV: "production" })
    expect(policy).toContain("default-src 'self'")
    expect(policy).toContain("https://js.stripe.com")
    expect(policy).toContain("https://api.stripe.com")
  })

  it("includes Firebase auth domain in connect-src and frame-src", () => {
    const policy = buildContentSecurityPolicy({
      NODE_ENV: "production",
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "umbrella.firebaseapp.com",
    })
    expect(policy).toContain("connect-src")
    expect(policy).toContain("frame-src")
    expect(policy).toContain("https://umbrella.firebaseapp.com")
  })

  it("includes Sentry ingest origin from DSN", () => {
    const policy = buildContentSecurityPolicy({
      NODE_ENV: "production",
      NEXT_PUBLIC_SENTRY_DSN:
        "https://abc123@o123.ingest.us.sentry.io/456",
    })
    expect(policy).toContain("https://o123.ingest.us.sentry.io")
  })

  it("includes wss origin for API URL WebSocket connections", () => {
    const policy = buildContentSecurityPolicy({
      NODE_ENV: "production",
      NEXT_PUBLIC_API_URL: "https://legal-api.odaflow.com",
    })
    expect(policy).toContain("https://legal-api.odaflow.com")
    expect(policy).toContain("wss://legal-api.odaflow.com")
  })

  it("includes report-uri when CSP_REPORT_URI is set", () => {
    const policy = buildContentSecurityPolicy({
      NODE_ENV: "production",
      CSP_REPORT_URI: "https://example.com/csp-report",
    })
    expect(policy).toContain("report-uri https://example.com/csp-report")
  })
})

describe("getContentSecurityPolicyHeader", () => {
  it("uses report-only header by default", () => {
    const header = getContentSecurityPolicyHeader({ NODE_ENV: "production" })
    expect(header).not.toBeNull()
    expect(header?.key).toBe("Content-Security-Policy-Report-Only")
    expect(header?.value).toContain("default-src 'self'")
  })

  it("uses enforce header when mode is enforce", () => {
    const header = getContentSecurityPolicyHeader(
      { NODE_ENV: "production", CSP_REPORT_ONLY: "true" },
      { mode: "enforce" },
    )
    expect(header?.key).toBe("Content-Security-Policy")
  })

  it("uses enforce header when CSP_REPORT_ONLY is false", () => {
    const header = getContentSecurityPolicyHeader({
      NODE_ENV: "production",
      CSP_REPORT_ONLY: "false",
    })
    expect(header?.key).toBe("Content-Security-Policy")
  })
})

describe("getStrictTransportSecurityHeader", () => {
  it("returns HSTS in production", () => {
    const header = getStrictTransportSecurityHeader({ NODE_ENV: "production" })
    expect(header?.key).toBe("Strict-Transport-Security")
    expect(header?.value).toContain("max-age=31536000")
  })

  it("skips HSTS in development", () => {
    expect(getStrictTransportSecurityHeader({ NODE_ENV: "development" })).toBeNull()
  })

  it("skips HSTS on Vercel preview deployments", () => {
    expect(
      getStrictTransportSecurityHeader({
        NODE_ENV: "production",
        VERCEL_ENV: "preview",
      }),
    ).toBeNull()
  })
})
