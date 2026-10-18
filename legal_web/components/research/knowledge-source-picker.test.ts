import { describe, expect, it } from "vitest"
import { recommendedKnowledgeSources } from "./knowledge-source-picker"

describe("recommendedKnowledgeSources", () => {
  it("uses case law, statutes, and web for the benchmark survey", () => {
    expect(
      recommendedKnowledgeSources(
        "CASE_SURVEY",
        "similar Indian cases involving arbitration clauses in partnership agreements",
      ),
    ).toEqual(["statutes", "case_law", "web"])
  })

  it("adds regulations only for a regulatory query", () => {
    expect(
      recommendedKnowledgeSources(
        "GENERAL_RESEARCH",
        "current data protection regulations and regulator circulars",
      ),
    ).toContain("regulations")
  })
})
