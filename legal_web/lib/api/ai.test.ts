import { describe, expect, it } from "vitest"
import { parseResearchJobResult, researchResultFromHistory } from "./ai"
import { REQUIRED_CITATION_CHECKS } from "./verification"

describe("legal research API normalization", () => {
  it("keeps rejected citations out of authoritative sources and preserves case metadata", () => {
    const checks = REQUIRED_CITATION_CHECKS.map((dimension) => ({
      dimension,
      state: "PASS" as const,
      reason: "Passed",
    }))
    const result = parseResearchJobResult({
      outputMarkdown: "Research answer",
      citations: [
        {
          title: "Internal title",
          caseName: "Alpha Ltd v Beta Ltd",
          authorityId: "authority-internal-1",
          citation: "(2024) 1 SCC 10",
          neutralCitation: "2024 INSC 10",
          decisionDate: "2024-02-03",
          relevantParagraphs: ["12", "18"],
          propositionActuallyDecided: "A concluded bargain is enforceable.",
        },
        {
          title: "Rejected case",
          authorityId: "authority-internal-2",
          citation: "(2020) 2 SCC 20",
        },
        {
          title: "Wrong-domain case",
          authorityId: "authority-internal-3",
          citation: "(2023) 4 SCC 30",
        },
      ],
      rejectedCandidates: [{
        authorityId: "authority-internal-3",
        gate: "case_relevance",
        reason: "Candidate concerns tax law, not the employment issue researched.",
      }],
      citationAudit: {
        verifiedCitationCount: 1,
        unsupportedClaims: [],
        warnings: [],
        totalCitations: 2,
        foundCitationCount: 2,
        citations: [{
          citation: "(2024) 1 SCC 10",
          authorityId: "authority-internal-1",
          found: true,
          verified: true,
          checks,
          missingReasons: [],
        }],
        rejectedCitations: [{
          citation: "(2020) 2 SCC 20",
          authorityId: "authority-internal-2",
          found: true,
          verified: false,
          checks: checks.map((check) =>
            check.dimension === "pinpoint" ? { ...check, state: "INDETERMINATE" as const } : check,
          ),
          missingReasons: ["pinpoint: No relevant paragraph was supplied."],
        }],
        verificationGaps: [{
          citation: "(2020) 2 SCC 20",
          reasons: ["pinpoint: No relevant paragraph was supplied."],
        }],
        safeForReliance: false,
      },
    })

    expect(result?.citations).toHaveLength(1)
    expect(result?.citations[0]).toMatchObject({
      title: "Alpha Ltd v Beta Ltd",
      neutralCitation: "2024 INSC 10",
      judgmentDate: "2024-02-03",
      relevantParagraphs: ["12", "18"],
      propositionActuallyDecided: "A concluded bargain is enforceable.",
    })
    expect(result?.citationAudit?.rejectedCitations).toHaveLength(1)
    expect(result?.citationAudit?.safeForReliance).toBe(false)
    expect(result?.rejectedCandidates).toEqual([{
      authorityId: "authority-internal-3",
      gate: "case_relevance",
      reason: "Candidate concerns tax law, not the employment issue researched.",
    }])
  })

  it("normalizes older audit payloads without detailed checks", () => {
    const result = parseResearchJobResult({
      outputMarkdown: "Legacy answer",
      citations: ["Legacy source"],
      citationAudit: {
        verifiedCitations: 2,
      },
    })

    expect(result?.citationAudit).toMatchObject({
      verifiedCitationCount: 2,
      unsupportedClaims: [],
      warnings: [],
    })
  })

  it("preserves the full publication contract from an async job", () => {
    const dimensions = {
      identity: { state: "PASS", pass: 1, fail: 0, indeterminate: 0, notApplicable: 0 },
      relevance: { state: "FAIL", pass: 0, fail: 1, indeterminate: 0, notApplicable: 0 },
      passage: { state: "PASS", pass: 1, fail: 0, indeterminate: 0, notApplicable: 0 },
      pinpoint: { state: "PASS", pass: 1, fail: 0, indeterminate: 0, notApplicable: 0 },
      quotation: { state: "NOT_APPLICABLE", pass: 0, fail: 0, indeterminate: 0, notApplicable: 1 },
      currentLaw: { state: "PASS", pass: 1, fail: 0, indeterminate: 0, notApplicable: 0 },
      treatment: { state: "PASS", pass: 1, fail: 0, indeterminate: 0, notApplicable: 0 },
      hierarchy: { state: "PASS", pass: 1, fail: 0, indeterminate: 0, notApplicable: 0 },
      coverage: { state: "FAIL", pass: 0, fail: 1, indeterminate: 0, notApplicable: 0 },
    }
    const findings = [{
      checkId: "coverage-1",
      state: "FAIL",
      severity: "HIGH",
      dimension: "coverage",
      evidenceIds: [],
      explanation: "No admissible case covered issue two.",
      verifierVersion: "2",
    }]
    const propositions = [{
      id: "proposition-1",
      text: "A live controversy is required.",
      type: "RULE",
      materiality: "MATERIAL",
      evidenceIds: ["authority-1"],
      supportState: "SUPPORTED",
    }]
    const issueGaps = [{ issueId: "issue-2", gapType: "no_case_law", reason: "No relevant judgment." }]
    const sourceDiagnostics = [{
      provider: "official-corpus",
      status: "searched",
      durationMs: 20,
      hitCount: 2,
    }]
    const connectorDiagnostics = [{
      provider: "india-live",
      status: "error",
      durationMs: 120,
      hitCount: 0,
      error: "Connector timed out.",
    }]
    const rejectedCandidates = [{
      authorityId: "tax-case-1",
      gate: "case_relevance",
      reason: "Wrong legal domain.",
    }]

    const result = parseResearchJobResult({
      outputMarkdown: "Async answer",
      citations: [{ title: "Relevant case", authorityId: "authority-1" }],
      caseLawSearchStatus: "error",
      findings,
      propositions,
      dimensions,
      publicationState: "VERIFIED_WITH_LIMITATIONS",
      outputHash: "sha256:async",
      issueGaps,
      sourceDiagnostics,
      connectorDiagnostics,
      rejectedCandidates,
    })

    expect(result).toMatchObject({
      caseLawSearchStatus: "error",
      findings,
      propositions,
      dimensions,
      publicationState: "VERIFIED_WITH_LIMITATIONS",
      outputHash: "sha256:async",
      issueGaps,
      sourceDiagnostics,
      connectorDiagnostics,
      rejectedCandidates,
    })
  })

  it("roundtrips optional high-confidence research contracts", () => {
    const payload = {
      outputMarkdown: "Task-aware answer",
      citations: [{
        title: "Official judgment",
        source: "Supreme Court",
        provenance: {
          sourceId: "source-1",
          sourceName: "Official court site",
          retrievedAt: "2026-07-27T10:00:00.000Z",
          contentHash: "sha256:source",
        },
        integrity: {
          status: "VERIFIED",
          hashVerified: true,
          passageVerified: true,
        },
      }],
      taskProfile: {
        taskKind: "MATTER_OPINION",
        objective: "Advise on the matter facts",
        matterAware: true,
        asOfDate: "2026-07-27",
      },
      researchPlan: {
        id: "plan-1",
        subQuestions: ["What is the rule?", "How does it apply?"],
        sourceRequirements: ["official primary law"],
        freshnessRequirement: "as_of_date",
        asOfDate: "2026-07-27",
      },
      capabilitySnapshot: {
        currentLawCheck: true,
        citationVerification: true,
        matterAccess: true,
      },
      sourceProvenance: [{ sourceId: "source-1", sourceTier: "OFFICIAL_PRIMARY" }],
      sourceIntegrity: { status: "VERIFIED", identityVerified: true },
      conflicts: [{
        id: "conflict-1",
        description: "Two courts apply different tests.",
        unresolved: true,
      }],
      confidenceAssessment: {
        level: "CORROBORATED",
        score: 0.84,
        blockers: ["One material fact remains unverified."],
      },
      publicationDecision: {
        decision: "PARTIAL",
        blockers: ["One material fact remains unverified."],
        publishableNodeIds: ["rule-1"],
      },
      factSummaries: [{
        id: "fact-1",
        statement: "Notice was served on 1 July.",
        status: "VERIFIED",
      }],
      propositionSummaries: [{
        id: "rule-1",
        statement: "Thirty days' notice is required.",
        kind: "LEGAL_RULE",
        supportStatus: "VERIFIED",
      }],
      authoritySummaries: ["The Supreme Court adopted the thirty-day rule."],
      applicationSummaries: ["The notice appears five days short."],
      assumptions: ["Service was effective on dispatch."],
      unresolvedFacts: ["The receipt date is unknown."],
      strategyGuidance: ["Obtain the delivery record before advising."],
      auditMetadata: {
        packetId: "packet-1",
        schemaVersion: "1.0",
        packetHash: "sha256:packet",
      },
    }

    const result = parseResearchJobResult(JSON.parse(JSON.stringify(payload)))

    expect(result).toMatchObject({
      taskProfile: payload.taskProfile,
      researchPlan: payload.researchPlan,
      capabilitySnapshot: payload.capabilitySnapshot,
      sourceProvenance: payload.sourceProvenance,
      sourceIntegrity: payload.sourceIntegrity,
      conflicts: payload.conflicts,
      confidence: "High",
      confidenceAssessment: payload.confidenceAssessment,
      publicationDecision: payload.publicationDecision,
      factSummaries: payload.factSummaries,
      propositionSummaries: payload.propositionSummaries,
      authoritySummaries: payload.authoritySummaries,
      applicationSummaries: payload.applicationSummaries,
      assumptions: payload.assumptions,
      unresolvedFacts: payload.unresolvedFacts,
      strategyGuidance: payload.strategyGuidance,
      auditMetadata: payload.auditMetadata,
    })
    expect(result?.citations[0]).toMatchObject({
      provenance: payload.citations[0].provenance,
      integrity: payload.citations[0].integrity,
    })
  })

  it("accepts singular summary and legacy task-profile aliases", () => {
    const result = parseResearchJobResult({
      outputMarkdown: "Compatible answer",
      researchTaskProfile: { kind: "CITATION_LOOKUP" },
      factSummary: [{ statement: "Identity confirmed.", status: "VERIFIED" }],
      propositionSummary: [{
        statement: "The neutral citation is 2026 INSC 1.",
        kind: "LEGAL_RULE",
      }],
      researchAudit: { packetId: "packet-alias" },
    })

    expect(result?.taskProfile?.kind).toBe("CITATION_LOOKUP")
    expect(result?.factSummaries?.[0].statement).toBe("Identity confirmed.")
    expect(result?.propositionSummaries?.[0].statement).toContain("2026 INSC 1")
    expect(result?.auditMetadata?.packetId).toBe("packet-alias")
  })

  it("restores evidence, audit, findings, structured draft, and age from history", () => {
    const result = researchResultFromHistory({
      id: "history-1",
      inputQuery: "What is the rule?",
      outputMarkdown: "Historical answer",
      preview: "Historical answer",
      createdAt: "2026-01-02T03:04:05.000Z",
      citationCount: 1,
      verified: false,
      citations: [{
        title: "Alpha v Beta",
        source: "Supreme Court",
        authorityId: "authority-1",
        exactPassage: "The exact retrieved words.",
        sourceUrl: "https://example.test/source",
        deepLinkUrl: "https://example.test/source#para-42",
      }],
      citationAudit: {
        verifiedCitationCount: 0,
        unsupportedClaims: [{ claim: "Unsupported proposition", citations: [] }],
        warnings: [],
        safeForReliance: false,
      },
      findings: [{
        checkId: "passage-1",
        state: "FAIL",
        severity: "BLOCKER",
        dimension: "passage",
        evidenceIds: ["authority-1"],
        explanation: "No meaningful overlap",
        verifierVersion: "1",
      }],
      propositions: [{
        id: "proposition-1",
        text: "The historical proposition.",
        type: "RULE",
        materiality: "MATERIAL",
        evidenceIds: ["authority-1"],
        supportState: "SUPPORTED",
      }],
      dimensions: {
        identity: { state: "PASS", pass: 1, fail: 0, indeterminate: 0, notApplicable: 0 },
        relevance: { state: "PASS", pass: 1, fail: 0, indeterminate: 0, notApplicable: 0 },
        passage: { state: "PASS", pass: 1, fail: 0, indeterminate: 0, notApplicable: 0 },
        pinpoint: { state: "PASS", pass: 1, fail: 0, indeterminate: 0, notApplicable: 0 },
        quotation: { state: "NOT_APPLICABLE", pass: 0, fail: 0, indeterminate: 0, notApplicable: 1 },
        currentLaw: { state: "PASS", pass: 1, fail: 0, indeterminate: 0, notApplicable: 0 },
        treatment: { state: "PASS", pass: 1, fail: 0, indeterminate: 0, notApplicable: 0 },
        hierarchy: { state: "PASS", pass: 1, fail: 0, indeterminate: 0, notApplicable: 0 },
        coverage: { state: "FAIL", pass: 0, fail: 1, indeterminate: 0, notApplicable: 0 },
      },
      structuredDraft: {
        directAnswer: { text: "No", confidence: 0.4 },
        issues: [],
        practicalSteps: [],
        limitations: ["Review required"],
        unansweredQuestions: [],
      },
      publicationState: "DRAFT_NOT_VERIFIED",
      outputHash: "sha256:history",
      caseLawSearchStatus: "no_hits",
      issueGaps: ["No appellate authority located."],
      sourceDiagnostics: [{
        provider: "official-corpus",
        status: "searched",
        durationMs: 12,
        hitCount: 0,
      }],
      connectorDiagnostics: [{
        provider: "india-live",
        status: "skipped",
        durationMs: 0,
        hitCount: 0,
      }],
      rejectedCandidates: [{
        authorityId: "authority-wrong-domain",
        gate: "case_relevance",
        reason: "Wrong legal domain.",
      }],
    })

    expect(result.citations[0]).toMatchObject({
      authorityId: "authority-1",
      exactPassage: "The exact retrieved words.",
      url: "https://example.test/source#para-42",
      canonicalUrl: "https://example.test/source",
      deepLinkUrl: "https://example.test/source#para-42",
    })
    expect(result.findings).toHaveLength(1)
    expect(result.propositions).toHaveLength(1)
    expect(result.dimensions?.coverage.state).toBe("FAIL")
    expect(result.publicationState).toBe("DRAFT_NOT_VERIFIED")
    expect(result.outputHash).toBe("sha256:history")
    expect(result.caseLawSearchStatus).toBe("no_hits")
    expect(result.issueGaps).toEqual(["No appellate authority located."])
    expect(result.sourceDiagnostics?.[0]).toMatchObject({ provider: "official-corpus", hitCount: 0 })
    expect(result.connectorDiagnostics?.[0]).toMatchObject({ provider: "india-live", status: "skipped" })
    expect(result.rejectedCandidates?.[0]).toMatchObject({
      authorityId: "authority-wrong-domain",
      gate: "case_relevance",
    })
    expect(result.structuredDraft?.limitations).toEqual(["Review required"])
    expect(result.generatedAt).toBe("2026-01-02T03:04:05.000Z")
    expect(result.fromCache).toBe(true)
  })

  it("normalizes partial structured drafts from history instead of crashing renderers", () => {
    const result = researchResultFromHistory({
      id: "history-partial",
      inputQuery: "Partial draft",
      outputMarkdown: "Fallback markdown answer",
      preview: "Fallback markdown answer",
      createdAt: "2026-01-02T03:04:05.000Z",
      citationCount: 0,
      structuredDraft: {
        directAnswer: { text: "Yes", confidence: 0.8 },
      } as import("./types").LegalResearchDraft,
    })

    expect(result.structuredDraft).toMatchObject({
      directAnswer: { text: "Yes", confidence: 0.8 },
      issues: [],
      limitations: [],
      practicalSteps: [],
      unansweredQuestions: [],
    })
    expect(result.answer).toContain("Fallback markdown answer")
  })

  it("drops structured drafts that cannot render a short answer", () => {
    const result = researchResultFromHistory({
      id: "history-empty-draft",
      inputQuery: "Broken draft",
      outputMarkdown: "Markdown only",
      preview: "Markdown only",
      createdAt: "2026-01-02T03:04:05.000Z",
      citationCount: 0,
      structuredDraft: { issues: [] } as unknown as import("./types").LegalResearchDraft,
    })

    expect(result.structuredDraft).toBeUndefined()
  })

  it("normalizes issue propositions when reopening saved or history research", () => {
    const result = researchResultFromHistory({
      id: "history-issue-no-propositions",
      inputQuery: "Family law question",
      outputMarkdown: "Fallback answer for family research",
      preview: "Fallback answer for family research",
      createdAt: "2026-01-02T03:04:05.000Z",
      citationCount: 0,
      structuredDraft: {
        directAnswer: { text: "Yes, subject to conditions.", confidence: 0.7 },
        issues: [{
          issueId: "issue-1",
          heading: "Custody threshold",
          conclusion: "Likely yes.",
        }],
      } as unknown as import("./types").LegalResearchDraft,
    })

    expect(result.structuredDraft?.issues[0]?.propositions).toEqual([])
    expect(result.answer).toContain("Fallback answer")
  })

  it("treats null publicationDecision as absent when restoring history", () => {
    const result = researchResultFromHistory({
      id: "history-null-publication",
      inputQuery: "Contract question",
      outputMarkdown: "Contract answer",
      preview: "Contract answer",
      createdAt: "2026-01-02T03:04:05.000Z",
      citationCount: 0,
      publicationDecision: null as unknown as import("./types").LegalResearchResponse["publicationDecision"],
    })

    expect(result.publicationDecision).toBeUndefined()
  })
})
