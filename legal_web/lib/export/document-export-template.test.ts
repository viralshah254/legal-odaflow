import { describe, expect, it } from "vitest"
import { buildPdfExportHtml, buildWordExportHtml } from "./document-export-template"

const branding = {
  umbrellaLogoSrc: "/logo.png",
  firmLogoDataUri: null,
}

describe("document export template", () => {
  it("injects draft watermark into PDF and Word exports", () => {
    const meta = { watermark: "DRAFT - NOT FOR FILING" }

    expect(buildPdfExportHtml("Draft", "Body", meta, branding)).toContain("DRAFT - NOT FOR FILING")
    expect(buildWordExportHtml("Draft", "Body", meta, branding)).toContain("DRAFT - NOT FOR FILING")
  })
})
