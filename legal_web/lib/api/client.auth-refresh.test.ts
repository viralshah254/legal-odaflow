import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  AUTH_EXPIRED_EVENT,
  apiFetch,
  setTokens,
} from "./client"
import { clearMemoryTokens } from "@/lib/auth/token-store"

describe("apiFetch 401 refresh", () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_USE_DIRECT_API", "true")
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://127.0.0.1:4000")
    vi.stubGlobal("fetch", fetchMock)
    clearMemoryTokens()
    setTokens("expired-access", "valid-refresh")
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    clearMemoryTokens()
  })

  it("retries once after refreshing tokens on 401", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "Unauthorized" }), {
          status: 401,
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            accessToken: "new-access",
            refreshToken: "new-refresh",
            tokenType: "Bearer",
            expiresIn: "3600",
            user: { id: "1", email: "a@b.com", name: null, userType: "LAWYER", countryCode: "IN" },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      )

    const result = await apiFetch<{ ok: boolean }>("/users/me")

    expect(result).toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock.mock.calls[1]?.[0]).toContain("/auth/refresh")
    expect(fetchMock.mock.calls[2]?.[1]?.headers?.get("Authorization")).toBe(
      "Bearer new-access",
    )
  })

  it("clears session and emits auth-expired when refresh fails", async () => {
    const expiredHandler = vi.fn()
    window.addEventListener(AUTH_EXPIRED_EVENT, expiredHandler)

    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "Unauthorized" }), {
          status: 401,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "Refresh failed" }), {
          status: 401,
        }),
      )

    await expect(apiFetch("/users/me")).rejects.toMatchObject({
      statusCode: 401,
    })

    expect(expiredHandler).toHaveBeenCalledTimes(1)
    window.removeEventListener(AUTH_EXPIRED_EVENT, expiredHandler)
  })

  it("does not emit auth-expired for anonymous 401 without tokens", async () => {
    clearMemoryTokens()
    const expiredHandler = vi.fn()
    window.addEventListener(AUTH_EXPIRED_EVENT, expiredHandler)

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "Unauthorized" }), {
        status: 401,
      }),
    )

    await expect(apiFetch("/users/me")).rejects.toMatchObject({
      statusCode: 401,
    })

    expect(expiredHandler).not.toHaveBeenCalled()
    window.removeEventListener(AUTH_EXPIRED_EVENT, expiredHandler)
  })
})
