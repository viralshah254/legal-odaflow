import { describe, expect, it } from "vitest"
import type { LegalResearchResponse } from "@/lib/api/types"
import {
  buildNewMatterResearchHref,
  buildResearchDocument,
  buildResearchMatterPrefill,
  inferResearchPracticeArea,
} from "./research-filing"

function result(overrides: Partial<LegalResearchResponse> = {}): LegalResearchResponse {
  return {
    answer: "The memo analysis.",
    citations: [{ title: "Example v State", source: "Official reporter", url: "https://example.test" }],
    mode: "LAWYER_LEGAL_RESEARCH",
    disclaimer: "Review required",
    researchMode: "DEEP",
    ...overrides,
  }
}

describe("research filing helpers", () => {
  it("builds an explicit AI-proposed matter prefill without treating research as facts", () => {
    const prefill = buildResearchMatterPrefill({
      query: "Can an employee challenge an unlawful dismissal?",
      result: result(),
      countryCode: "GB",
      sourceResearchId: "output-1",
      clientId: "client-1",
    })
    expect(prefill.practiceArea).toBe("employment_labour")
    expect(prefill.factsSummary).toContain("not confirmed client facts")

    const href = buildNewMatterResearchHref(prefill)
    const params = new URL(href, "https://umbrella.test").searchParams
    expect(params.get("aiProposed")).toBe("1")
    expect(params.get("sourceResearchId")).toBe("output-1")
    expect(params.get("clientId")).toBe("client-1")
    expect(params.get("factsSummary")).toContain("not confirmed client facts")
  })

  it("watermarks unsafe documents and includes citations, verification, and provenance", () => {
    const document = buildResearchDocument({
      title: "Bail research",
      query: "What is the bail test?",
      countryCode: "IN",
      aiOutputId: "output-unsafe",
      result: result({
        publicationState: "DRAFT_NOT_VERIFIED",
        citationAudit: {
          verifiedCitationCount: 0,
          unsupportedClaims: [{ claim: "Unsupported proposition", citations: [] }],
          warnings: [],
          safeForReliance: false,
        },
      }),
    })
    expect(document.draftOnly).toBe(true)
    expect(document.fileName).toMatch(/^UNVERIFIED-DRAFT-.*\.md$/)
    expect(document.contents).toContain("UNVERIFIED DRAFT — NOT FOR RELIANCE")
    expect(document.contents).toContain("## Citations")
    expect(document.contents).toContain("## Verification appendix")
    expect(document.contents).toContain("AI output ID: output-unsafe")
  })

  it("does not watermark a source-verified document", () => {
    const document = buildResearchDocument({
      title: "Verified memo",
      query: "Question",
      result: result({
        citationAudit: {
          verifiedCitationCount: 1,
          unsupportedClaims: [],
          warnings: [],
          totalCitations: 1,
          verifiedCitations: 1,
          foundCitationCount: 1,
          safeForReliance: true,
          citations: [{
            citation: "Example v State",
            found: true,
            verified: true,
            checks: [
              "identity",
              "relevance",
              "passage",
              "pinpoint",
              "jurisdiction",
              "currentLaw",
              "hierarchy",
            ].map((dimension) => ({
              dimension: dimension as "identity",
              state: "PASS" as const,
              reason: "Confirmed",
            })),
            missingReasons: [],
          }],
        },
      }),
    })
    expect(document.draftOnly).toBe(false)
    expect(document.fileName).toBe("Verified-memo.md")
  })

  it("falls back to litigation for an unclassified query", () => {
    expect(inferResearchPracticeArea("A novel procedural question")).toBe("litigation_disputes")
  })
})
