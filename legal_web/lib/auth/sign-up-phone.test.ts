import { describe, expect, it } from "vitest"
import { resolveSignUpPhone } from "./sign-up-phone"

describe("resolveSignUpPhone", () => {
  it("returns E.164 phone for valid Indian number", () => {
    const result = resolveSignUpPhone("IN", "9876543210")
    expect(result).toEqual({ phone: "+919876543210" })
  })

  it("requires national digits", () => {
    expect(resolveSignUpPhone("IN", "")).toEqual({ error: "required" })
    expect(resolveSignUpPhone("IN", "   ")).toEqual({ error: "required" })
  })

  it("rejects invalid format", () => {
    expect(resolveSignUpPhone("IN", "12345")).toEqual({ error: "invalid" })
  })
})
