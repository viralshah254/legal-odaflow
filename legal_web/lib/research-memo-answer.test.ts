import { execFileSync } from "node:child_process"
import { describe, expect, it, vi } from "vitest"
import {
  defaultWhyQuestionMatters,
  normalizePracticalSteps,
  normalizeUnansweredQuestions,
  questionAction,
} from "@/components/research/research-follow-on"

function renderTaskMemo(taskKind: string): string {
  const script = `
    import { createElement } from "react";
    import { renderToStaticMarkup } from "react-dom/server";
    import { ResearchMemoAnswer } from "./components/research/research-memo-answer.tsx";
    const result = {
      answer: "Fallback answer",
      citations: [],
      mode: "LAWYER_LEGAL_RESEARCH",
      disclaimer: "Review required",
      taskProfile: { taskKind: ${JSON.stringify(taskKind)} },
      propositionSummaries: [{
        statement: "The verified legal rule.",
        kind: "LEGAL_RULE",
        supportStatus: "VERIFIED",
      }],
      authoritySummaries: ["The authority summary."],
      applicationSummaries: ["The fact application."],
      assumptions: ["The stated assumption."],
      unresolvedFacts: ["The unresolved fact."],
      strategyGuidance: ["The strategic option."],
    };
    process.stdout.write(renderToStaticMarkup(createElement(ResearchMemoAnswer, { result })));
  `
  return execFileSync(
    process.execPath,
    ["--import", "tsx", "--input-type=module", "--eval", script],
    { cwd: process.cwd(), encoding: "utf8" },
  )
}

function renderKenyaCitation(): string {
  const script = `
    import { createElement } from "react";
    import { renderToStaticMarkup } from "react-dom/server";
    import { ResearchMemoAnswer } from "./components/research/research-memo-answer.tsx";
    const result = {
      answer: "See Example v State [2024] KESC 12 (KLR).",
      citations: [{
        title: "Example v State",
        source: "Kenya Law",
        citation: "[2024] KESC 12 (KLR)",
        pinpoint: "paragraph 42",
        canonicalUrl: "https://new.kenyalaw.org/example",
        deepLinkUrl: "https://new.kenyalaw.org/example#para-42",
      }],
      mode: "LAWYER_LEGAL_RESEARCH",
      disclaimer: "Review required",
      jurisdiction: "KE",
      citationAudit: { verifiedCitationCount: 1, kenyaVerified: true, warnings: [], unsupportedClaims: [] },
    };
    process.stdout.write(renderToStaticMarkup(createElement(ResearchMemoAnswer, { result })));
  `
  return execFileSync(
    process.execPath,
    ["--import", "tsx", "--input-type=module", "--eval", script],
    { cwd: process.cwd(), encoding: "utf8" },
  )
}

describe("research memo follow-on data", () => {
  it("normalizes legacy strings without losing their original values", () => {
    const practicalStep = "Preserve the original correspondence."
    const question = "When was notice received?"

    expect(normalizePracticalSteps([practicalStep])).toEqual([{
      original: practicalStep,
      index: 0,
      text: practicalStep,
      timing: "NOW",
      purpose: undefined,
      evidence: [],
      dependencies: [],
    }])
    expect(normalizeUnansweredQuestions([question])).toEqual([{
      original: question,
      index: 0,
      text: question,
      id: undefined,
      whyItMatters: defaultWhyQuestionMatters,
    }])
  })

  it("normalizes structured steps into the three display groups", () => {
    const steps = normalizePracticalSteps([
      {
        action: "Send a preservation notice.",
        timing: "NOW",
        purpose: "Prevent deletion.",
        evidenceNeeded: ["Document retention policy"],
      },
      {
        step: "Confirm the limitation date.",
        stage: "BEFORE_FILING_OR_ADVISING",
        dependencies: ["Date notice was received"],
      },
      {
        action: "Seek interim relief.",
        timing: "IF_FACTS_SUPPORT_IT",
      },
    ])

    expect(steps.map((step) => step.timing)).toEqual([
      "NOW",
      "BEFORE_FILING_OR_ADVISING",
      "IF_FACTS_SUPPORT",
    ])
    expect(steps[0]).toMatchObject({
      purpose: "Prevent deletion.",
      evidence: ["Document retention policy"],
      dependencies: [],
    })
    expect(steps[1].dependencies).toEqual(["Date notice was received"])
  })

  it("preserves structured question context for action callbacks", () => {
    const question = {
      id: "question-1",
      question: "Was consent recorded?",
      whyItMatters: "Consent determines whether the processing was lawful.",
    }
    const normalized = normalizeUnansweredQuestions([question])
    const callback = vi.fn()

    expect(normalized[0]).toMatchObject({
      text: question.question,
      id: question.id,
      whyItMatters: question.whyItMatters,
    })
    questionAction(callback, normalized[0].original, normalized[0].index)()
    expect(callback).toHaveBeenCalledWith(question, 0)
  })

  it("drops blank entries so empty sections are not rendered", () => {
    expect(normalizePracticalSteps(["  "])).toEqual([])
    expect(normalizeUnansweredQuestions(["  "])).toEqual([])
  })

  it("renders only authoritative sections for citation tasks", () => {
    const html = renderTaskMemo("CITATION_LOOKUP")

    expect(html).toContain("Verified law")
    expect(html).toContain("Authority summary")
    expect(html).not.toContain("Fact application")
    expect(html).not.toContain("Assumptions")
    expect(html).not.toContain("Unresolved facts")
    expect(html).not.toContain("Strategy / non-authoritative guidance")
  })

  it("separates law, facts, assumptions, gaps, and strategy for matter opinions", () => {
    const html = renderTaskMemo("MATTER_OPINION")

    expect(html).toContain("Verified law")
    expect(html).toContain("Authority summary")
    expect(html).toContain("Fact application")
    expect(html).toContain("Assumptions")
    expect(html).toContain("Unresolved facts")
    expect(html).toContain("Strategy / non-authoritative guidance")
  })

  it("renders Kenya verification state and backend paragraph deep links", () => {
    const html = renderKenyaCitation()

    expect(html).toContain("Kenya Verified:")
    expect(html).toContain("Open cited passage")
    expect(html).toContain("https://new.kenyalaw.org/example#para-42")
  })
})
