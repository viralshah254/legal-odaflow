import { describe, expect, it } from "vitest"
import {
  PROFILE_COMPLETION_REQUIRED,
  readProfileFromBody,
} from "./firebase-profile-completion"

describe("readProfileFromBody", () => {
  it("reads nested NestJS message object", () => {
    expect(
      readProfileFromBody({
        statusCode: 422,
        message: {
          code: PROFILE_COMPLETION_REQUIRED,
          message: "Complete your profile to finish sign up",
          email: "user@example.com",
          name: "Test User",
        },
      }),
    ).toEqual({ email: "user@example.com", name: "Test User" })
  })

  it("reads DomainExceptionFilter error.details shape", () => {
    expect(
      readProfileFromBody({
        error: {
          code: "VALIDATION_FAILED",
          message: "Complete your profile to finish sign up",
          details: {
            code: PROFILE_COMPLETION_REQUIRED,
            email: "user@example.com",
            name: null,
          },
        },
      }),
    ).toEqual({ email: "user@example.com", name: null })
  })
})
