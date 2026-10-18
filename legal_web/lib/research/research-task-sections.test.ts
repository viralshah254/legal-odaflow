import { describe, expect, it } from "vitest"
import {
  canonicalResearchTaskKind,
  researchSectionVisibility,
  researchTaskLabel,
} from "./research-task-sections"

describe("task-aware research section visibility", () => {
  it.each([
    ["CITATION_LOOKUP", "citation", false, false, false],
    ["SECTION", "section", false, false, false],
    ["CASE_ANALYSIS", "case_analysis", true, true, false],
    ["CASE_COMPARISON", "case_comparison", true, true, false],
    ["PROCEDURE", "procedure", true, true, false],
    ["GENERAL_RESEARCH", "general", false, true, false],
    ["MATTER_OPINION", "matter_opinion", true, true, true],
  ] as const)(
    "gates %s sections",
    (taskKind, canonical, factApplication, unresolvedFacts, strategyGuidance) => {
      const profile = { taskKind }
      const visibility = researchSectionVisibility(profile)

      expect(canonicalResearchTaskKind(profile)).toBe(canonical)
      expect(visibility.verifiedLaw).toBe(true)
      expect(visibility.authoritySummary).toBe(true)
      expect(visibility.factApplication).toBe(factApplication)
      expect(visibility.unresolvedFacts).toBe(unresolvedFacts)
      expect(visibility.strategyGuidance).toBe(strategyGuidance)
    },
  )

  it("preserves all existing sections when an old response has no task profile", () => {
    expect(researchSectionVisibility()).toEqual({
      verifiedLaw: true,
      authoritySummary: true,
      factApplication: true,
      assumptions: true,
      unresolvedFacts: true,
      strategyGuidance: true,
      practicalSteps: true,
    })
    expect(researchTaskLabel()).toBeUndefined()
  })

  it("accepts classifier and display aliases", () => {
    expect(canonicalResearchTaskKind({ primary: "STATUTORY_INTERPRETATION" })).toBe("section")
    expect(canonicalResearchTaskKind({ primary: "CITATION_VERIFICATION" })).toBe("citation")
    expect(canonicalResearchTaskKind({ primary: "CASE_LOOKUP" })).toBe("case_analysis")
    expect(canonicalResearchTaskKind({ kind: "procedural-strategy" })).toBe("procedure")
    expect(researchTaskLabel({ kind: "MATTER_OPINION" })).toBe("Matter opinion")
  })
})
