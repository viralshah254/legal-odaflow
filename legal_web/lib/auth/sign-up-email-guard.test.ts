import { describe, expect, it } from "vitest"
import { buildSignInUrl, resolveSignUpEmailGuard } from "./sign-up-email-guard"

describe("resolveSignUpEmailGuard", () => {
  it("redirects existing password accounts to sign-in", () => {
    expect(
      resolveSignUpEmailGuard({
        lookup: { exists: true, hasPassword: true, hasFirebaseAccount: false },
      }),
    ).toBe("redirect_sign_in")
  })

  it("blocks OAuth-only accounts", () => {
    expect(
      resolveSignUpEmailGuard({
        lookup: { exists: true, hasPassword: false, hasFirebaseAccount: false },
      }),
    ).toBe("social_only")
  })

  it("redirects existing Firebase email/password accounts to sign-in", () => {
    expect(
      resolveSignUpEmailGuard({
        lookup: { exists: true, hasPassword: false, hasFirebaseAccount: true },
      }),
    ).toBe("redirect_sign_in")
  })

  it("allows new emails", () => {
    expect(
      resolveSignUpEmailGuard({
        lookup: { exists: false, hasPassword: false, hasFirebaseAccount: false },
      }),
    ).toBe("allow")
  })

  it("allows sign-up when lookup failed", () => {
    expect(resolveSignUpEmailGuard({ lookupFailed: true })).toBe("lookup_unavailable")
  })

  it("allows sign-up when lookup is missing", () => {
    expect(resolveSignUpEmailGuard({ lookup: null })).toBe("allow")
  })
})

describe("buildSignInUrl", () => {
  it("builds auth url with email and redirect", () => {
    expect(
      buildSignInUrl({
        email: "user@example.com",
        redirectTo: "/app",
        refCode: "REF1",
      }),
    ).toBe("/auth/?email=user%40example.com&redirect=%2Fapp&ref=REF1")
  })

  it("returns bare auth path when no params", () => {
    expect(buildSignInUrl({ email: "" })).toBe("/auth/")
  })
})
