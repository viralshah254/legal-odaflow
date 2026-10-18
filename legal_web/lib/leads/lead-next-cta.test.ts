import { describe, expect, it } from "vitest"
import { resolveLeadNextCta } from "./lead-next-cta"

describe("resolveLeadNextCta", () => {
  it("uses one research CTA from the tool plan", () => {
    const cta = resolveLeadNextCta({
      recommendedNextTool: "retrieve",
      facts: "Client seeks regular bail under BNSS 480",
      issueType: "Criminal Matter",
      countryCode: "IN",
    })
    expect(cta.label).toBe("Research this issue")
    expect(cta.href).toContain("/app/research?")
    expect(cta.href).toContain("BNSS")
  })

  it("uses a draft CTA when the plan says draft", () => {
    const cta = resolveLeadNextCta({
      recommendedNextTool: "draft",
      issueType: "Habeas corpus",
      facts: "Illegal detention",
    })
    expect(cta.label).toBe("Draft this vehicle")
    expect(cta.href).toContain("/app/india-drafting/draft?")
  })

  it("points at the missing slot when intake is incomplete", () => {
    const cta = resolveLeadNextCta({
      recommendedNextTool: "retrieve",
      missingSlots: ["offenceDate"],
    })
    expect(cta.label).toBe("Complete missing slot: offenceDate")
    expect(cta.href).toBe("#lead-case-context")
  })
})
