import { describe, expect, it } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { LegalMarkdown } from "@/components/legal/legal-markdown"

describe("LegalMarkdown", () => {
  it("renders javascript links as plain text", () => {
    const html = renderToStaticMarkup(
      <LegalMarkdown content={"[click me](javascript:alert(1))"} />,
    )
    expect(html).not.toContain('href="javascript:')
    expect(html).toContain("click me")
  })

  it("renders safe https links with rel noopener", () => {
    const html = renderToStaticMarkup(
      <LegalMarkdown content={"[docs](https://example.com)"} />,
    )
    expect(html).toContain('href="https://example.com"')
    expect(html).toContain('rel="noopener noreferrer"')
  })
})
