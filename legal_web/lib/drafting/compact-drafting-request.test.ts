import { describe, expect, it } from "vitest"
import {
  compactDraftingRequest,
  DRAFT_INTENT_COMPACT_LENGTH,
  DRAFT_INTENT_MAX_LENGTH,
} from "./compact-drafting-request"

describe("compactDraftingRequest", () => {
  it("leaves an API-safe request unchanged", () => {
    const request = "Draft a legal notice for unpaid invoices."

    expect(compactDraftingRequest(request)).toBe(request)
  })

  it("returns a bounded, reviewable version of a long drafting request", () => {
    const request = [
      "Parties: Acme Ltd and Example Co.",
      ...Array.from({ length: 900 }, (_, index) => `Fact ${index}: detailed background.`),
      "Drafting request:",
      "- Legal Notice",
      "- Interim Injunction Application",
      "Requested relief: preserve records.",
    ].join("\n")

    const compacted = compactDraftingRequest(request)

    expect(request.length).toBeGreaterThan(DRAFT_INTENT_MAX_LENGTH)
    expect(compacted.length).toBeLessThanOrEqual(DRAFT_INTENT_COMPACT_LENGTH)
    expect(compacted).toContain("Legal Notice")
    expect(compacted).toContain("Interim Injunction Application")
    expect(compacted).toContain("Long source condensed")
  })
})
