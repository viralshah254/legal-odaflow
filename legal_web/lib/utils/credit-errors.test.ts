import { describe, expect, it } from "vitest"
import { ApiClientError } from "@/lib/api/client"
import {
  isInsufficientCreditsError,
  isInsufficientCreditsMessage,
} from "@/lib/utils/credit-errors"

describe("isInsufficientCreditsMessage", () => {
  it("detects daily free-tier exhaustion copy", () => {
    expect(
      isInsufficientCreditsMessage(
        "You've used your AI credits for today. Subscribe to continue or wait for your daily reset.",
      ),
    ).toBe(true)
  })

  it("detects insufficient balance copy", () => {
    expect(
      isInsufficientCreditsMessage(
        "Insufficient AI credits (2 available, ~5 required). Subscribe or wait for your daily credits to reset.",
      ),
    ).toBe(true)
  })

  it("ignores unrelated errors", () => {
    expect(isInsufficientCreditsMessage("Could not reach the server.")).toBe(false)
  })
})

describe("isInsufficientCreditsError", () => {
  it("detects 403 credit errors from the API client", () => {
    const error = new ApiClientError(
      "You've used your AI credits for today. Subscribe to continue or wait for your daily reset.",
      403,
    )
    expect(isInsufficientCreditsError(error)).toBe(true)
  })

  it("ignores 403 errors that are not credit related", () => {
    const error = new ApiClientError("You do not have access to this tenant.", 403)
    expect(isInsufficientCreditsError(error)).toBe(false)
  })
})
