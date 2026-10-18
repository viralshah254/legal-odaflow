import { execFileSync } from "node:child_process"
import { describe, expect, it } from "vitest"

function renderFixtures(): { trust: string; actions: string; card: string } {
  const script = `
    import { createElement } from "react";
    import { renderToStaticMarkup } from "react-dom/server";
    import { ResearchVerificationActions } from "./components/research/research-verification-actions.tsx";
    import { ResearchVerificationTrustLabels } from "./components/research/research-verification-trust-labels.tsx";
    import { ResearchVerificationCard } from "./components/research/research-verification-card.tsx";

    const tasks = {
      citationTasks: [{
        id: "citation-1",
        citation: "Example v State",
        supportState: "IDENTITY_ONLY",
        reasons: ["Passage not retrieved"],
      }],
      unsupportedPropositions: [{
        id: "proposition-1",
        proposition: "The remedy is automatic.",
        citations: ["Example v State"],
      }],
    };
    const trust = renderToStaticMarkup(createElement(ResearchVerificationTrustLabels, {
      audit: { verifiedCitationCount: 0, safeForReliance: false },
      requiresLawyerReview: true,
      fromCache: true,
    }));
    const actions = renderToStaticMarkup(createElement(ResearchVerificationActions, {
      tasks,
      onResolveCitationTask: () => {},
      onReviewUnsupportedProposition: () => {},
    }));
    const card = renderToStaticMarkup(createElement(ResearchVerificationCard, {
      citationAudit: {
        verifiedCitationCount: 0,
        safeForReliance: false,
        warnings: [],
        unsupportedClaims: [],
        citations: tasks.citationTasks.map((task) => ({
          citation: task.citation,
          found: true,
          verified: false,
          checks: [{ dimension: "identity", state: "PASS", reason: "Identity matched" }],
          missingReasons: task.reasons,
        })),
      },
      totalCitations: 1,
      fromCache: true,
    }));
    process.stdout.write(JSON.stringify({ trust, actions, card }));
  `
  return JSON.parse(execFileSync(
    process.execPath,
    ["--import", "tsx", "--input-type=module", "--eval", script],
    { cwd: process.cwd(), encoding: "utf8" },
  )) as { trust: string; actions: string; card: string }
}

describe("research verification components", () => {
  it("separates automated, human, current-law, and cache labels", () => {
    const { trust: html } = renderFixtures()

    expect(html).toContain("Automated verification")
    expect(html).toContain("Human approval")
    expect(html).toContain("Lawyer review required")
    expect(html).toContain("Current-law check")
    expect(html).toContain("Result freshness")
    expect(html).toContain("Cached result")
  })

  it("summarizes tasks and renders direct task actions", () => {
    const { actions: html } = renderFixtures()

    expect(html).toContain("1 citation task")
    expect(html).toContain("1 unsupported proposition")
    expect(html).toContain("Identity matched; passage support not established")
    expect(html).toContain("Resolve")
    expect(html).toContain("Review")
  })

  it("keeps raw diagnostics collapsed by default", () => {
    const { card: html } = renderFixtures()

    expect(html).toContain("Raw verification diagnostics")
    expect(html).not.toContain("Required citation checks")
    expect(html).toContain("Identity matched; passage support not established")
  })
})
