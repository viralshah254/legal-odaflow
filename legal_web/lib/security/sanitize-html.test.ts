import { describe, expect, it } from "vitest"
import { escapeHtml, sanitizeDocumentHtml } from "./sanitize-html"

describe("sanitizeDocumentHtml", () => {
  it("strips script tags", () => {
    const result = sanitizeDocumentHtml("<p>ok</p><script>alert(1)</script>")
    expect(result).not.toContain("<script")
    expect(result).not.toContain("alert(1)")
    expect(result).toContain("ok")
  })

  it("strips event handlers from images", () => {
    const result = sanitizeDocumentHtml('<img src="x" onerror="alert(1)">')
    expect(result).not.toContain("onerror")
    expect(result).not.toContain("alert(1)")
  })

  it("preserves tables", () => {
    const result = sanitizeDocumentHtml("<table><tr><td>ok</td></tr></table>")
    expect(result).toContain("<table")
    expect(result).toContain("<td>ok</td>")
  })

  it("preserves class on mark elements", () => {
    const result = sanitizeDocumentHtml('<mark class="bg-amber-100">filled</mark>')
    expect(result).toContain('class="bg-amber-100"')
    expect(result).toContain("filled")
  })
})

describe("escapeHtml", () => {
  it("escapes angle brackets", () => {
    expect(escapeHtml("<script>")).toBe("&lt;script&gt;")
  })
})
