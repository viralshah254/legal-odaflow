import { describe, expect, it } from "vitest"
import {
  buildDraftOutline,
  draftHeadingId,
  getDraftExportAvailability,
  parseReadinessBlocker,
} from "@/lib/drafting/draft-workspace"

describe("draft review workspace", () => {
  it("builds stable navigation from document headings", () => {
    const draft = [
      "# IN THE HIGH COURT",
      "Introductory text",
      "## GROUNDS",
      "### Ground **A**",
    ].join("\n")

    expect(buildDraftOutline(draft)).toEqual([
      { id: "draft-section-0-in-the-high-court", level: 1, text: "IN THE HIGH COURT" },
      { id: "draft-section-2-grounds", level: 2, text: "GROUNDS" },
      { id: "draft-section-3-ground-a", level: 3, text: "Ground A" },
    ])
    expect(draftHeadingId("GROUNDS", 2)).toBe("draft-section-2-grounds")
  })

  it("turns labeled readiness blockers into section, reason, and action", () => {
    expect(
      parseReadinessBlocker(
        "section: Prayer | reason: Relief exceeds pleaded facts | action: Narrow the requested relief",
      ),
    ).toEqual({
      raw: "section: Prayer | reason: Relief exceeds pleaded facts | action: Narrow the requested relief",
      section: "Prayer",
      reason: "Relief exceeds pleaded facts",
      action: "Narrow the requested relief",
    })
  })

  it("provides useful fallbacks for blocker codes", () => {
    expect(parseReadinessBlocker("citation_identity_unverified")).toMatchObject({
      section: "Document-wide",
      reason: "Citation identity unverified",
    })
  })

  it("keeps review-copy export available while filing remains gated", () => {
    expect(
      getDraftExportAvailability({
        draftText: "Working draft",
        systemChecksPassed: false,
        authorityChecksPassed: false,
        advocateApproved: false,
      }),
    ).toEqual({
      canExportReviewCopy: true,
      canExportForFiling: false,
    })

    expect(
      getDraftExportAvailability({
        draftText: "Approved draft",
        systemChecksPassed: true,
        authorityChecksPassed: true,
        advocateApproved: true,
      }).canExportForFiling,
    ).toBe(true)
  })
})
