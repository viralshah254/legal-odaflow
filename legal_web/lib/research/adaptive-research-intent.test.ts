import { describe, expect, it } from "vitest"
import {
  inferAdaptiveResearchPreview,
  researchRecipeForTask,
} from "./adaptive-research-intent"

describe("adaptive research intent preview", () => {
  it("classifies the reported partnership-arbitration question as a case survey", () => {
    expect(
      inferAdaptiveResearchPreview(
        "What are similar cases in Indian law where arbitration clauses in partnership agreements were enforced or disputed, and what were the key outcomes?",
      ),
    ).toEqual(
      expect.objectContaining({
        taskKind: "CASE_SURVEY",
        targetCases: 3,
        targetSections: 1,
      }),
    )
  })

  it.each([
    ["Show the text of section 11 of the Arbitration Act", "SECTION_LOOKUP"],
    ["Interpret the scope of section 11 of the Arbitration Act", "STATUTORY_INTERPRETATION"],
    ["What procedure and limitation applies to this filing?", "PROCEDURE"],
    ["What is the current law and latest position on arbitrator appointments?", "CURRENT_LAW"],
    ["Explain the doctrine of separability", "GENERAL_RESEARCH"],
    [
      "What remedies, if any, are available to a tenant in India when a landlord issues a notice to vacate before the contractual notice period expires, without a stated valid reason, and the tenant has no alternative accommodation?",
      "GENERAL_RESEARCH",
    ],
    [
      "Case Type: Criminal Bail Matter\nLaw: BNSS\nProvision: Section 480 BNSS\nCourt: Sessions Court, Ahmedabad\nIssue: Whether the accused should be granted regular bail",
      "MATTER_OPINION",
    ],
  ])("previews %s as %s", (query, taskKind) => {
    expect(inferAdaptiveResearchPreview(query).taskKind).toBe(taskKind)
  })

  it("describes net-new adaptive evidence instead of a quota", () => {
    expect(researchRecipeForTask("CASE_SURVEY")).toContain("Up to 3")
    expect(researchRecipeForTask("SECTION_LOOKUP")).toContain("without unrelated case padding")
  })
})
