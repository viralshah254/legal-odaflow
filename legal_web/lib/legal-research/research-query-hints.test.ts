import { describe, expect, it } from "vitest"
import {
  buildDeepResearchSteps,
  buildFastResearchSteps,
  buildGuidanceResearchSteps,
} from "./research-query-hints"

const t = (key: string) => key

describe("research progress steps", () => {
  it("uses short honest steps for Fast and AI only", () => {
    const fast = buildFastResearchSteps("What can I do about unpaid invoices?", "KE", t)
    const guidance = buildGuidanceResearchSteps("What can I do about unpaid invoices?", "KE", t)

    expect(fast.map((step) => step.id)).toEqual(["parse", "draft", "ready"])
    expect(guidance.map((step) => step.id)).toEqual(["parse", "draft", "ready"])
    expect(fast.some((step) => /retrieve|predecessor|audit|corpus|live/i.test(step.id ?? ""))).toBe(false)
    expect(fast.every((step) => !step.rotatingDetails?.length)).toBe(true)
  })

  it("adds a same-call self-check step for Verified only", () => {
    const deep = buildDeepResearchSteps("What can I do about unpaid invoices?", "KE", t)
    expect(deep.map((step) => step.id)).toEqual(["parse", "draft", "selfcheck", "ready"])
    expect(deep.some((step) => step.id === "retrieve" || step.id === "audit")).toBe(false)
  })
})
