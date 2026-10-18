import { execFileSync } from "node:child_process"
import { describe, expect, it } from "vitest"

function renderPanel(items: unknown[]): string {
  const script = `
    import { createElement } from "react";
    import { renderToStaticMarkup } from "react-dom/server";
    import { SavedResearchPanel } from "./components/research/saved-research-panel.tsx";
    process.stdout.write(renderToStaticMarkup(createElement(SavedResearchPanel, {
      items: ${JSON.stringify(items)},
      loading: false,
    })));
  `
  return execFileSync(
    process.execPath,
    ["--import", "tsx", "--input-type=module", "--eval", script],
    { cwd: process.cwd(), encoding: "utf8" },
  )
}

describe("SavedResearchPanel", () => {
  it("renders firm filing, verification, manual review, query, and open link", () => {
    const html = renderPanel([{
        id: "saved-1",
        title: "Employment memo",
        query: "Can the employee challenge dismissal?",
        clientId: "client-1",
        matterId: "matter-1",
        aiOutputId: "output-1",
        createdAt: "2026-07-27T08:00:00.000Z",
        verification: {
          status: "verified",
          verified: true,
          safeForReliance: true,
          requiresLawyerReview: false,
          manualReview: { total: 1, pending: 0, complete: true },
        },
      }])

    expect(html).toContain("Employment memo")
    expect(html).toContain("Can the employee challenge dismissal?")
    expect(html).toContain("Firm-filed")
    expect(html).toContain("Verified")
    expect(html).toContain("Manual review complete")
    expect(html).toContain("/app/research?savedResearchId=saved-1")
  })

  it("never presents an unsafe record as verified", () => {
    const html = renderPanel([{
        id: "saved-2",
        title: "Draft memo",
        query: "Question",
        clientId: "client-1",
        createdAt: "2026-07-27T08:00:00.000Z",
        verification: {
          status: "unverified",
          verified: false,
          safeForReliance: false,
          requiresLawyerReview: true,
          manualReview: { total: 0, pending: 0, complete: false },
        },
      }])
    expect(html).toContain("Verification required")
    expect(html).toContain("Not manually reviewed")
  })
})
