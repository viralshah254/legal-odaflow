import { describe, expect, it } from "vitest"
import { FirebaseError } from "firebase/app"
import { isConnectionError, isDuplicateEmailError } from "./duplicate-email-error"
import { USER_CONNECTION_ERROR } from "@/lib/errors/user-facing-messages"

describe("isDuplicateEmailError", () => {
  it("detects Firebase email-already-in-use", () => {
    expect(
      isDuplicateEmailError(
        new FirebaseError("auth/email-already-in-use", "Email already in use"),
      ),
    ).toBe(true)
  })

  it("detects backend already registered message", () => {
    expect(isDuplicateEmailError(new Error("Email is already registered"))).toBe(true)
  })

  it("returns false for unrelated errors", () => {
    expect(isDuplicateEmailError(new Error("Invalid password"))).toBe(false)
  })
})

describe("isConnectionError", () => {
  it("detects user connection error constant", () => {
    expect(isConnectionError(new Error(USER_CONNECTION_ERROR))).toBe(true)
  })

  it("detects network failures", () => {
    expect(isConnectionError(new Error("Failed to fetch"))).toBe(true)
  })
})
