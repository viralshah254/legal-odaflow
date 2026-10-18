import { describe, expect, it } from "vitest"
import { isSafeImageUrl, isSafeNavigableUrl } from "./safe-url"

describe("isSafeNavigableUrl", () => {
  it("allows https links", () => {
    expect(isSafeNavigableUrl("https://example.com")).toBe(true)
  })

  it("rejects javascript links", () => {
    expect(isSafeNavigableUrl("javascript:alert(1)")).toBe(false)
  })

  it("allows relative paths", () => {
    expect(isSafeNavigableUrl("/app/matters")).toBe(true)
  })
})

describe("isSafeImageUrl", () => {
  it("rejects data URIs", () => {
    expect(isSafeImageUrl("data:image/png;base64,abc")).toBe(false)
  })

  it("allows https image URLs", () => {
    expect(isSafeImageUrl("https://cdn.example.com/logo.png")).toBe(true)
  })
})
