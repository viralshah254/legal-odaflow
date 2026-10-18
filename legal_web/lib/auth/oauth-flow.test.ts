import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const {
  readOAuthRedirectPendingMock,
  clearOAuthRedirectPendingMock,
  completeOAuthRedirectIfNeededMock,
  waitForFirebaseAuthUserMock,
  getFirebaseAuthMock,
  getFirebaseIdTokenMock,
  resetOAuthRedirectResultCacheMock,
} = vi.hoisted(() => ({
  readOAuthRedirectPendingMock: vi.fn<() => "google" | "apple" | null>(),
  clearOAuthRedirectPendingMock: vi.fn(),
  completeOAuthRedirectIfNeededMock: vi.fn(),
  waitForFirebaseAuthUserMock: vi.fn(),
  getFirebaseAuthMock: vi.fn(),
  getFirebaseIdTokenMock: vi.fn(),
  resetOAuthRedirectResultCacheMock: vi.fn(),
}))

vi.mock("@/lib/auth/oauth-redirect-pending", () => ({
  readOAuthRedirectPending: readOAuthRedirectPendingMock,
  clearOAuthRedirectPending: clearOAuthRedirectPendingMock,
  saveOAuthRedirectPending: vi.fn(),
}))

vi.mock("@/lib/firebase", () => ({
  completeOAuthRedirectIfNeeded: completeOAuthRedirectIfNeededMock,
  waitForFirebaseAuthUser: waitForFirebaseAuthUserMock,
  getFirebaseAuth: getFirebaseAuthMock,
  getFirebaseIdToken: getFirebaseIdTokenMock,
  getFirebaseUserProfile: vi.fn(() => null),
  resetOAuthRedirectResultCache: resetOAuthRedirectResultCacheMock,
  signInWithGoogle: vi.fn(),
  signInWithApple: vi.fn(),
}))

import {
  completeOAuthRedirectLogin,
  isOAuthRedirectTimeout,
  resetOAuthRedirectLoginCache,
} from "./oauth-flow"

describe("completeOAuthRedirectLogin", () => {
  const loginWithFirebase = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    resetOAuthRedirectLoginCache()
    readOAuthRedirectPendingMock.mockReturnValue(null)
    completeOAuthRedirectIfNeededMock.mockResolvedValue(null)
    waitForFirebaseAuthUserMock.mockResolvedValue(false)
    getFirebaseAuthMock.mockReturnValue({ currentUser: null, providerData: [] })
  })

  afterEach(() => {
    resetOAuthRedirectLoginCache()
  })

  it("returns none immediately when no redirect is pending", async () => {
    const outcome = await completeOAuthRedirectLogin(loginWithFirebase)
    expect(outcome).toEqual({ status: "none" })
    expect(loginWithFirebase).not.toHaveBeenCalled()
  })

  it("completes login when redirect result is available", async () => {
    readOAuthRedirectPendingMock.mockReturnValue("apple")
    completeOAuthRedirectIfNeededMock.mockResolvedValue({
      providerId: "apple.com",
    })
    getFirebaseIdTokenMock.mockResolvedValue("token-123")
    loginWithFirebase.mockResolvedValue({ user: { id: "u1" } })

    const outcome = await completeOAuthRedirectLogin(loginWithFirebase)
    expect(outcome.status).toBe("authenticated")
    expect(clearOAuthRedirectPendingMock).toHaveBeenCalled()
  })

  it("allows a retry after cache reset when pending flag is set", async () => {
    readOAuthRedirectPendingMock.mockReturnValue("google")
    completeOAuthRedirectIfNeededMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ providerId: "google.com" })
    waitForFirebaseAuthUserMock.mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    getFirebaseAuthMock.mockReturnValue({
      currentUser: { providerData: [{ providerId: "google.com" }] },
    })

    const first = await completeOAuthRedirectLogin(loginWithFirebase)
    expect(first).toEqual({ status: "none" })

    resetOAuthRedirectLoginCache()
    getFirebaseIdTokenMock.mockResolvedValue("token-456")
    loginWithFirebase.mockResolvedValue({ user: { id: "u2" } })

    const second = await completeOAuthRedirectLogin(loginWithFirebase)
    expect(second.status).toBe("authenticated")
  })

  it("times out hung redirect completion", async () => {
    vi.useFakeTimers()
    readOAuthRedirectPendingMock.mockReturnValue("apple")
    completeOAuthRedirectIfNeededMock.mockImplementation(
      () => new Promise(() => undefined),
    )

    const pending = completeOAuthRedirectLogin(loginWithFirebase)
    const expectation = expect(pending).rejects.toSatisfy((error: unknown) =>
      isOAuthRedirectTimeout(error),
    )
    await vi.advanceTimersByTimeAsync(15_500)
    await expectation
    vi.useRealTimers()
  })
})
