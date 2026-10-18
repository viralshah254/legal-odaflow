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

  it("strips triple-check verification dumps from answer markdown", () => {
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

    expect(sanitizeResearchAnswer(memo)).not.toMatch(/Triple-check verification/i)
    expect(sanitizeResearchAnswer(memo)).toContain("Executive answer")
    expect(sanitizeResearchAnswer(memo)).toContain("Section 23 bars unlawful objects")
  })

  it("strips inline unsupported-claim prefixes", () => {
    expect(
      sanitizeResearchAnswer(
        "Unsupported by retrieved passages unless counsel verifies independently: Parties may not contract out.",
      ),
    ).toBe("Parties may not contract out.")
  })
})
