import { describe, expect, it } from "vitest"
import {
  describeResearchContextSelection,
  toggleResearchContextId,
} from "@/lib/research/matter-context-selection"

describe("matter research context helpers", () => {
  it("adds, deduplicates, and removes explicit selections", () => {
    expect(toggleResearchContextId([], "doc-1", true)).toEqual(["doc-1"])
    expect(toggleResearchContextId(["doc-1"], "doc-1", true)).toEqual(["doc-1"])
    expect(toggleResearchContextId(["doc-1", "doc-2"], "doc-1", false)).toEqual(["doc-2"])
  })

  it("clearly describes an empty selection", () => {
    expect(describeResearchContextSelection(0, 0)).toBe(
      "Matter profile and graph only; no document or prior-research text will be used.",
    )
  })

  it("describes exactly what the run will use", () => {
    expect(describeResearchContextSelection(2, 1)).toBe(
      "2 documents and 1 prior research item will be used with the matter profile.",
    )
  })
})
