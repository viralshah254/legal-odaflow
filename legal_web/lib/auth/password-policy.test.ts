import { describe, expect, it } from "vitest"
import { validatePasswordPolicy } from "@/lib/auth/password-policy"

describe("validatePasswordPolicy", () => {
  it("rejects passwords shorter than 8 characters", () => {
    const result = validatePasswordPolicy("pass1")
    expect(result.valid).toBe(false)
    expect(result.errors).toContain("tooShort")
  })

  it("rejects passwords without a number", () => {
    const result = validatePasswordPolicy("password")
    expect(result.valid).toBe(false)
    expect(result.errors).toContain("missingNumber")
  })

  it("accepts a password with 8 characters and a number", () => {
    const result = validatePasswordPolicy("secure12")
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })
})
