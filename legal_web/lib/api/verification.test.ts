import { describe, expect, it } from "vitest"
import {
  fallbackDimensions,
  buildResearchVerificationTasks,
  citationPassageSupportState,
  fullyVerifiedCitationCount,
  getResearchRelianceState,
  buildResearchVerificationAppendix,
  humanizeResearchFinding,
  isCitationAuditSafe,
  isBoilerplateResearchProposition,
  isResearchVerifiedForDisplay,
  publicationStateLabel,
  REQUIRED_CITATION_CHECKS,
  researchRelianceLabel,
  summarizeCitationChecks,
  type CitationAuditEntry,
} from "./verification"

describe("verification API helpers", () => {
  it("labels certification as lawyer review instead of filing verification", () => {
    expect(publicationStateLabel("READY_FOR_LAWYER_REVIEW")).toBe("Ready for lawyer review")
    expect(publicationStateLabel("VERIFICATION_UNAVAILABLE")).toBe("Verification incomplete")
  })

  it("downgrades missing dimension payloads to not-applicable chips", () => {
    const dimensions = fallbackDimensions()
    expect(dimensions.treatment.state).toBe("NOT_APPLICABLE")
    expect(dimensions.hierarchy.state).toBe("NOT_APPLICABLE")
  })

  it("humanizes internal verifier jargon for the UI", () => {
    expect(humanizeResearchFinding("Application proposition lacks factIds and basedOnClaimIds")).toContain(
      "Application to your facts needs review",
    )
  })

  it("suppresses verified badge when verification is unavailable", () => {
    expect(isResearchVerifiedForDisplay("VERIFICATION_UNAVAILABLE", true)).toBe(false)
    expect(isResearchVerifiedForDisplay("READY_FOR_LAWYER_REVIEW")).toBe(false)
    expect(isResearchVerifiedForDisplay("READY_FOR_LAWYER_REVIEW", true, false)).toBe(false)
  })

  it("counts only citations passing every required check", () => {
    const complete: CitationAuditEntry = {
      citation: "2024 INSC 100",
      found: true,
      verified: true,
      checks: REQUIRED_CITATION_CHECKS.map((dimension) => ({
        dimension,
        state: "PASS" as const,
        reason: "Passed",
      })),
      missingReasons: [],
    }
    const missingPinpoint = {
      ...complete,
      citation: "2023 INSC 50",
      checks: complete.checks.filter((check) => check.dimension !== "pinpoint"),
    }
    const audit = {
      verifiedCitationCount: 2,
      citations: [complete, missingPinpoint],
      safeForReliance: true,
    }

    expect(fullyVerifiedCitationCount(audit)).toBe(1)
    expect(summarizeCitationChecks(audit).pinpoint).toBe("INDETERMINATE")
    expect(isCitationAuditSafe(audit)).toBe(false)
  })

  it("never reports green checks when reliance is unsafe", () => {
    const entry: CitationAuditEntry = {
      citation: "Example v State",
      found: true,
      verified: true,
      checks: REQUIRED_CITATION_CHECKS.map((dimension) => ({
        dimension,
        state: "PASS" as const,
        reason: "Passed",
      })),
      missingReasons: [],
    }
    const audit = {
      verifiedCitationCount: 1,
      citations: [entry],
      safeForReliance: false,
    }

    expect(Object.values(summarizeCitationChecks(audit))).not.toContain("PASS")
    expect(fullyVerifiedCitationCount(audit)).toBe(1)
    expect(isCitationAuditSafe(audit)).toBe(false)
  })

  it("does not treat legacy checked counts as fully verified", () => {
    expect(fullyVerifiedCitationCount({ verifiedCitationCount: 4 })).toBe(0)
  })

  it("does not claim passage support from an identity-only match", () => {
    const identityOnly: CitationAuditEntry = {
      citation: "Example v State",
      found: true,
      verified: true,
      checks: [{ dimension: "identity", state: "PASS", reason: "Identity matched" }],
      missingReasons: [],
    }

    expect(citationPassageSupportState(identityOnly)).toBe("IDENTITY_ONLY")
    expect(fullyVerifiedCitationCount({
      verifiedCitationCount: 1,
      citations: [identityOnly],
      safeForReliance: true,
    })).toBe(0)
  })

  it("filters disclaimer and fallback lines out of the review queue", () => {
    expect(isBoilerplateResearchProposition("Unverified AI guidance — model knowledge only.")).toBe(true)
    expect(isBoilerplateResearchProposition("Unsupported proposition: Legal research note Question: what can I do?")).toBe(true)
    expect(isBoilerplateResearchProposition("The supplier may suspend after unpaid invoices.")).toBe(false)

    const tasks = buildResearchVerificationTasks({
      audit: {
        verifiedCitationCount: 0,
        safeForReliance: false,
        unsupportedClaims: [
          { claim: "Unverified AI guidance — model knowledge only.", citations: [] },
          { claim: "Lawyer review required.", citations: [] },
          { claim: "Notice and cure must be confirmed from the contract.", citations: [] },
        ],
      },
      propositions: [{
        id: "prop_1",
        text: "Legal research note Question: what can I do?",
        type: "LEGAL_RULE",
        materiality: "MATERIAL",
        evidenceIds: [],
        supportState: "UNSUPPORTED",
      }],
    })

    expect(tasks.unsupportedPropositions.map((task) => task.proposition)).toEqual([
      "Notice and cure must be confirmed from the contract.",
    ])
  })

  it("builds actionable citation and unsupported-proposition queues", () => {
    const tasks = buildResearchVerificationTasks({
      audit: {
        verifiedCitationCount: 0,
        safeForReliance: false,
        citations: [{
          citation: "Example v State",
          found: true,
          verified: false,
          checks: [{ dimension: "identity", state: "PASS", reason: "Identity matched" }],
          missingReasons: ["Passage not retrieved"],
        }],
        unsupportedClaims: [{ claim: "The remedy is automatic.", citations: ["Example v State"] }],
      },
      propositions: [{
        id: "proposition-2",
        text: "Damages are mandatory.",
        type: "LEGAL_RULE",
        materiality: "MATERIAL",
        evidenceIds: [],
        supportState: "UNSUPPORTED",
      }],
    })

    expect(tasks.citationTasks).toHaveLength(1)
    expect(tasks.citationTasks[0]).toMatchObject({
      citation: "Example v State",
      supportState: "IDENTITY_ONLY",
    })
    expect(tasks.unsupportedPropositions.map((task) => task.proposition)).toEqual([
      "The remedy is automatic.",
      "Damages are mandatory.",
    ])
  })

  it("uses honest reliance states and treats blockers as unsafe", () => {
    expect(getResearchRelianceState({ researchMode: "DEEP" })).toBe("unavailable")
    expect(getResearchRelianceState({ researchMode: "FAST" })).toBe("limited")
    expect(getResearchRelianceState({ researchMode: "GUIDANCE" })).toBe("limited")
    expect(getResearchRelianceState({
      findings: [{
        checkId: "passage-1",
        state: "FAIL",
        severity: "BLOCKER",
        dimension: "passage",
        evidenceIds: [],
        explanation: "No supporting passage",
        verifierVersion: "1",
      }],
    })).toBe("unsafe")
    expect(getResearchRelianceState({
      audit: {
        verifiedCitationCount: 1,
        safeForReliance: true,
        unsupportedClaims: [{ claim: "Unsupported", citations: [] }],
      },
    })).toBe("unsafe")
  })

  it("labels thin-RAG analytical mode as analytical guidance, not source-verified", () => {
    expect(
      getResearchRelianceState({
        analyticalMode: true,
        relianceMode: "analytical-guidance",
        researchMode: "DEEP",
        audit: {
          verifiedCitationCount: 0,
          safeForReliance: false,
          unsupportedClaims: [],
        },
      }),
    ).toBe("analytical-guidance")
    expect(researchRelianceLabel("analytical-guidance")).toBe(
      "Analytical guidance (confirm locally)",
    )
  })

  it("labels corrected and AI-suggested states distinctly from source-verified", () => {
    expect(
      getResearchRelianceState({
        hasCorrectedAuthorities: true,
        researchMode: "DEEP",
        audit: { verifiedCitationCount: 0, safeForReliance: false, unsupportedClaims: [] },
      }),
    ).toBe("corrected")
    expect(getResearchRelianceState({ aiSuggestedOnly: true })).toBe("ai-suggested")
    expect(researchRelianceLabel("source-verified")).toContain("2–3 checks")
    expect(researchRelianceLabel("ai-suggested")).toContain("not verified")
  })

  it("builds an audit appendix with unsupported claims and citation checks", () => {
    const appendix = buildResearchVerificationAppendix({
      researchMode: "DEEP",
      audit: {
        verifiedCitationCount: 0,
        safeForReliance: false,
        citations: [{
          citation: "Example v State",
          found: true,
          verified: false,
          checks: [{ dimension: "passage", state: "FAIL", reason: "No matching passage" }],
          missingReasons: ["pinpoint unavailable"],
        }],
        unsupportedClaims: [{ claim: "The remedy is automatic.", citations: ["Example v State"] }],
      },
    })

    expect(appendix).toContain("Unsafe for reliance")
    expect(appendix).toContain("The remedy is automatic.")
    expect(appendix).toContain("passage: FAIL")
  })
})
