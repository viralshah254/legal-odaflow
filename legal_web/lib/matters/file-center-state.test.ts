import { describe, expect, it } from "vitest"
import {
  buildFileCenterHref,
  isDocumentReviewReady,
  resolveFileCenterView,
  selectAllFiltered,
  toggleDocumentSelection,
} from "./file-center-state"

const document = {
  id: "document-1",
  tenantId: "tenant-1",
  fileName: "agreement.pdf",
  status: "ACTIVE" as const,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
}

describe("matter file center state", () => {
  it("routes Files, AI Review, Generate, and E-sign through the URL", () => {
    expect(resolveFileCenterView(null)).toBe("files")
    expect(resolveFileCenterView("unknown")).toBe("files")
    expect(resolveFileCenterView("ai-review")).toBe("ai-review")
    expect(buildFileCenterHref("matter-1", "ai-review", "source=nav")).toBe(
      "/app/matters/matter-1/documents?source=nav&view=ai-review",
    )
    expect(buildFileCenterHref("matter-1", "files", "view=ai-review&source=nav")).toBe(
      "/app/matters/matter-1/documents?source=nav",
    )
    expect(resolveFileCenterView("generate")).toBe("generate")
    expect(resolveFileCenterView("esign")).toBe("esign")
    expect(buildFileCenterHref("matter-1", "generate")).toBe(
      "/app/matters/matter-1/documents?view=generate",
    )
    expect(buildFileCenterHref("matter-1", "esign", "source=draft")).toBe(
      "/app/matters/matter-1/documents?source=draft&view=esign",
    )
    expect(buildFileCenterHref("matter-1", "ai-review", "view=esign&documentName=Offer")).toBe(
      "/app/matters/matter-1/documents?view=ai-review&documentName=Offer",
    )
  })

  it("recognizes review readiness from text, MIME type, or extraction state", () => {
    expect(isDocumentReviewReady({ ...document, extractedText: "content" })).toBe(true)
    expect(isDocumentReviewReady({ ...document, mimeType: "text/plain" })).toBe(true)
    expect(isDocumentReviewReady({ ...document, extractionStatus: "completed" })).toBe(true)
    expect(isDocumentReviewReady({ ...document, extractionStatus: "failed" })).toBe(false)
  })

  it("selects filtered files without duplicates and toggles deterministically", () => {
    expect(selectAllFiltered(["a", "hidden"], ["a", "b"])).toEqual(["a", "hidden", "b"])
    expect(toggleDocumentSelection(["a", "b"], "a")).toEqual(["b"])
    expect(toggleDocumentSelection(["b"], "a")).toEqual(["b", "a"])
  })
})
