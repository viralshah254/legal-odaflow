import { describe, expect, it } from "vitest"
import { ApiClientError } from "@/lib/api/client"
import { USER_CONNECTION_ERROR } from "@/lib/errors/user-facing-messages"
import {
  CLOUDFLARE_CHALLENGE_ERROR,
  isCloudflareChallengeError,
  isCloudflareChallengeResponse,
  isRetryableIntakeSaveError,
  looksLikeCloudflareChallenge,
} from "./cloudflare-challenge"

describe("looksLikeCloudflareChallenge", () => {
  it("detects the human-verification interstitial", () => {
    expect(
      looksLikeCloudflareChallenge(
        "<!DOCTYPE html><html><title>Just a moment...</title><div>Verifying you are human</div></html>",
      ),
    ).toBe(true)
  })

  it("ignores normal JSON API errors", () => {
    expect(looksLikeCloudflareChallenge('{"message":"You do not have access to this tenant."}')).toBe(
      false,
    )
  })
})

describe("isCloudflareChallengeResponse", () => {
  it("treats HTML 403 and cf-mitigated as a challenge", () => {
    expect(
      isCloudflareChallengeResponse({
        status: 403,
        contentType: "text/html",
        body: "<html>Attention Required! Cloudflare</html>",
      }),
    ).toBe(true)
    expect(
      isCloudflareChallengeResponse({
        status: 200,
        cfMitigated: "challenge",
        body: "",
      }),
    ).toBe(true)
  })
})

describe("isRetryableIntakeSaveError", () => {
  it("retries challenge, dropped fetch, and gateway cuts — not a real 500", () => {
    expect(
      isRetryableIntakeSaveError(new ApiClientError(CLOUDFLARE_CHALLENGE_ERROR, 403, { challenge: true })),
    ).toBe(true)
    expect(isRetryableIntakeSaveError(new Error("Failed to fetch"))).toBe(true)
    expect(isRetryableIntakeSaveError(new Error(USER_CONNECTION_ERROR))).toBe(true)
    expect(isRetryableIntakeSaveError(new ApiClientError("Internal Server Error", 500))).toBe(false)
    expect(isCloudflareChallengeError(new ApiClientError("<html>Just a moment...</html>", 403))).toBe(
      true,
    )
  })
})
