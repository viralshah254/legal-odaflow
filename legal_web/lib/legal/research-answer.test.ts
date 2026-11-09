import { describe, expect, it } from "vitest"
import { linkResearchCitations, sanitizeResearchAnswer } from "./research-answer"

describe("research answer display helpers", () => {
  it("links only citations that have a matching source", () => {
    expect(linkResearchCitations("Rule [1], exception [3], existing [2](https://example.com).", 2))
      .toBe("Rule [1](#source-1), exception [3], existing [2](https://example.com).")
  })

  it("removes machine-readable follow-up payloads", () => {
    expect(sanitizeResearchAnswer("Answer.\nFOLLOW_UP_QUESTIONS_JSON: [\"Next?\"]"))
      .toBe("Answer.")
  })

  it("preserves verification findings in answer markdown", () => {
    const memo = [
      "## Executive answer",
      "No — parties cannot waive the Act wholesale.",
      "## Mandatory vs default",
      "| Section | Bucket |",
      "## Triple-check verification",
      "- **Section 23** — VERIFIED (2/3)",
      "## Analysis",
      "Section 23 bars unlawful objects.",
    ].join("\n")

    expect(sanitizeResearchAnswer(memo)).toMatch(/Triple-check verification/i)
    expect(sanitizeResearchAnswer(memo)).toContain("Executive answer")
    expect(sanitizeResearchAnswer(memo)).toContain("Section 23 bars unlawful objects")
  })

  it("preserves inline unsupported-claim warnings", () => {
    expect(
      sanitizeResearchAnswer(
        "Unsupported by retrieved passages unless counsel verifies independently: Parties may not contract out.",
      ),
    ).toBe("Unsupported by retrieved passages unless counsel verifies independently: Parties may not contract out.")
  })
})
