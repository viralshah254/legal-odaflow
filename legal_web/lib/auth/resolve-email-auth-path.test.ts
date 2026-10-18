import { describe, expect, it } from "vitest"
import { resolveEmailAuthPath } from "./resolve-email-auth-path"

describe("resolveEmailAuthPath", () => {
  it("routes confirmed new email to sign_up", () => {
    expect(
      resolveEmailAuthPath({
        signInMethods: [],
        lookup: { exists: false, hasPassword: false, hasFirebaseAccount: false },
      }),
    ).toBe("sign_up")
  })

  it("routes new email with Firebase password orphan to enter_password", () => {
    expect(
      resolveEmailAuthPath({
        signInMethods: ["password"],
        lookup: { exists: false, hasPassword: false, hasFirebaseAccount: false },
      }),
    ).toBe("enter_password")
  })

  it("routes to sign_up when lookup fails and no Firebase password method", () => {
    expect(
      resolveEmailAuthPath({
        signInMethods: [],
        lookupFailed: true,
      }),
    ).toBe("sign_up")
  })

  it("routes to enter_password when lookup fails but Firebase has password", () => {
    expect(
      resolveEmailAuthPath({
        signInMethods: ["password"],
        lookupFailed: true,
      }),
    ).toBe("enter_password")
  })

  it("routes existing password account to enter_password", () => {
    expect(
      resolveEmailAuthPath({
        signInMethods: [],
        lookup: { exists: true, hasPassword: true, hasFirebaseAccount: false },
      }),
    ).toBe("enter_password")
  })

  it("routes existing password account with Firebase password method to enter_password", () => {
    expect(
      resolveEmailAuthPath({
        signInMethods: ["password"],
        lookup: { exists: true, hasPassword: true, hasFirebaseAccount: false },
      }),
    ).toBe("enter_password")
  })

  it("routes social-only backend account to social_only", () => {
    expect(
      resolveEmailAuthPath({
        signInMethods: [],
        lookup: { exists: true, hasPassword: false, hasFirebaseAccount: false },
      }),
    ).toBe("social_only")
  })

  it("routes backend OAuth account to social_only when Firebase hides sign-in methods", () => {
    expect(
      resolveEmailAuthPath({
        signInMethods: [],
        lookup: { exists: true, hasPassword: false, hasFirebaseAccount: true },
      }),
    ).toBe("social_only")
  })

  it("routes Firebase email/password account without backend hash to enter_password", () => {
    expect(
      resolveEmailAuthPath({
        signInMethods: ["password"],
        lookup: { exists: true, hasPassword: false, hasFirebaseAccount: true },
      }),
    ).toBe("enter_password")
  })

  it("routes Firebase password method without lookup to enter_password", () => {
    expect(
      resolveEmailAuthPath({
        signInMethods: ["password"],
        lookup: null,
      }),
    ).toBe("enter_password")
  })

  it("routes Firebase social-only methods to social_only", () => {
    expect(
      resolveEmailAuthPath({
        signInMethods: ["google.com"],
        lookup: null,
      }),
    ).toBe("social_only")
  })

  it("prefers backend password account over Firebase social-only methods", () => {
    expect(
      resolveEmailAuthPath({
        signInMethods: ["google.com"],
        lookup: { exists: true, hasPassword: true, hasFirebaseAccount: false },
      }),
    ).toBe("enter_password")
  })

  it("defaults to sign_up when methods empty and lookup unavailable", () => {
    expect(
      resolveEmailAuthPath({
        signInMethods: [],
        lookup: null,
      }),
    ).toBe("sign_up")
  })
})
