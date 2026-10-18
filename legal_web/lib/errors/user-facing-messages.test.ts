import { describe, expect, it } from "vitest"
import {
  extractApiErrorMessage,
  isDeveloperFacingErrorMessage,
  RESEARCH_JOB_CALM_FALLBACK,
  sanitizeResearchJobError,
  toUserFacingErrorMessage,
  USER_CONNECTION_ERROR,
  COMPLIANCE_POLICY_UNAVAILABLE_MESSAGE,
} from "./user-facing-messages"

describe("user-facing error messages", () => {
  it("flags developer-only copy", () => {
    expect(
      isDeveloperFacingErrorMessage(
        "Check that the backend is running on port 4000 and try again.",
      ),
    ).toBe(true)
    expect(isDeveloperFacingErrorMessage("Check API_URL configuration.")).toBe(true)
  })

  it("keeps product copy for oauth-only accounts", () => {
    const oauth =
      "This account uses Google or Apple sign-in. Use those options instead of a password."
    expect(isDeveloperFacingErrorMessage(oauth)).toBe(false)
    expect(toUserFacingErrorMessage(oauth)).toBe(oauth)
  })

  it("replaces infra errors with a friendly fallback", () => {
    expect(
      toUserFacingErrorMessage(
        "Could not reach the server. Check that the backend is running on port 4000 and try again.",
      ),
    ).toBe(USER_CONNECTION_ERROR)
  })

  it("extracts nested backend error messages", () => {
    expect(
      extractApiErrorMessage(
        {
          error: {
            code: "HTTP_503",
            message: "AI service is temporarily unavailable. Please try again in a moment.",
          },
        },
        "Request failed",
      ),
    ).toBe("AI service is temporarily unavailable. Please try again in a moment.")
  })

  it("never surfaces a BullMQ stall string", () => {
    expect(sanitizeResearchJobError("job stalled more than allowable limit")).toBe(
      RESEARCH_JOB_CALM_FALLBACK,
    )
    expect(toUserFacingErrorMessage("job stalled more than allowable limit")).toBe(
      RESEARCH_JOB_CALM_FALLBACK,
    )
    expect(
      toUserFacingErrorMessage("Sign-in timed out. Try again or use email and password."),
    ).toBe("Sign-in timed out. Try again or use email and password.")
  })

  it("maps missing compliance policy to a country-unavailable message", () => {
    expect(
      toUserFacingErrorMessage("Compliance policy not found for FR"),
    ).toBe(COMPLIANCE_POLICY_UNAVAILABLE_MESSAGE)
  })
})
