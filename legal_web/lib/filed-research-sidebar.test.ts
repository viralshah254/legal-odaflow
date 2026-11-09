import { execFileSync } from "node:child_process"
import { describe, expect, it } from "vitest"

function renderSidebar(items: unknown[], withFocus = true): string {
  const script = `
    import { createElement } from "react";
    import { renderToStaticMarkup } from "react-dom/server";
    import FiledResearchSidebarModule from "./components/smart-workspace/filed-research-sidebar.tsx"; const { FiledResearchSidebar } = FiledResearchSidebarModule;
    process.stdout.write(renderToStaticMarkup(createElement(FiledResearchSidebar, {
      items: ${JSON.stringify(items)},
      ${withFocus ? "onFocusOnCanvas: () => undefined," : ""}
    })));
  `
  return execFileSync(
    process.execPath,
    ["--import", "tsx", "--input-type=module", "--eval", script],
    { cwd: process.cwd(), encoding: "utf8" },
  )
}

describe("FiledResearchSidebar", () => {
  it("renders filed research items with open links", () => {
    const html = renderSidebar([{
      id: "saved-1",
      clientId: "client-1",
      title: "Liability memo",
      query: "What is the standard?",
      createdAt: "2026-07-27T08:00:00.000Z",
      aiOutputId: "output-1",
      countryCode: "IN",
      researchJson: {},
      verification: {
        status: "verified",
        verified: true,
        safeForReliance: true,
        requiresLawyerReview: false,
        approvedByLawyerId: null,
        manualReview: { total: 0, pending: 0, complete: false },
      },
    }])

    expect(html).toContain("Liability memo")
    expect(html).toContain("/app/research?savedResearchId=saved-1")
    expect(html).toContain("On canvas")
  })

  it("shows empty state when no research is filed", () => {
    const html = renderSidebar([], false)
    expect(html).toContain("File research from Legal Research")
  })
})
