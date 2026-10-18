import { afterEach, describe, expect, it } from "vitest"
import { resolveFirebaseInitAuthDomain } from "./firebase-init-json.server"

describe("resolveFirebaseInitAuthDomain", () => {
  const originalAuthDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
  const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL

  it("maps okaylegal.ai apex to canonical Firebase auth domain", () => {
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = "umbrella.okaylegal.ai"
    process.env.NEXT_PUBLIC_APP_URL = "https://umbrella.okaylegal.ai"
    expect(resolveFirebaseInitAuthDomain("okaylegal.ai")).toBe("umbrella.okaylegal.ai")
    expect(resolveFirebaseInitAuthDomain("www.okaylegal.ai")).toBe("umbrella.okaylegal.ai")
  })

  it("returns configured host for exact auth domain match", () => {
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = "umbrella.okaylegal.ai"
    expect(resolveFirebaseInitAuthDomain("umbrella.okaylegal.ai")).toBe(
      "umbrella.okaylegal.ai",
    )
  })

  afterEach(() => {
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = originalAuthDomain
    process.env.NEXT_PUBLIC_APP_URL = originalAppUrl
  })
})
