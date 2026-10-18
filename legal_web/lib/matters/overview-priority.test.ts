import { describe, expect, it } from "vitest"

import {
  normalizeMatterRiskScore,
  selectMatterOverviewPriority,
  shouldRenderPriorityDisclosure,
} from "./overview-priority"

describe("matter overview priority selection", () => {
  it("normalizes fractional and percentage risk scores", () => {
    expect(normalizeMatterRiskScore(0.6)).toBe(60)
    expect(normalizeMatterRiskScore(60)).toBe(60)
    expect(normalizeMatterRiskScore(null)).toBe(0)
    expect(normalizeMatterRiskScore(Number.NaN)).toBe(0)
  })

  it("uses Ask AI as the only action below the high-risk threshold", () => {
    expect(selectMatterOverviewPriority(0.59)).toEqual({
      primary: "ask-ai",
      suggestions: [],
      normalizedRiskScore: 59,
    })
  })

  it("promotes risk review and discloses Ask AI as an alternative", () => {
    expect(selectMatterOverviewPriority(0.6)).toEqual({
      primary: "review-risk",
      suggestions: ["ask-ai"],
      normalizedRiskScore: 60,
      riskLevel: "high",
    })
    expect(selectMatterOverviewPriority(85).riskLevel).toBe("critical")
  })

  it("only renders the disclosure when alternatives exist", () => {
    expect(shouldRenderPriorityDisclosure(undefined)).toBe(false)
    expect(shouldRenderPriorityDisclosure([])).toBe(false)
    expect(shouldRenderPriorityDisclosure(["ask-ai"])).toBe(true)
  })
})
