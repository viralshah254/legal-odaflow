import { describe, expect, it } from "vitest"
import {
  getMatterWorkspaceLinks,
  isMatterWorkspaceLinkActive,
} from "./matters/workspace-links"

describe("getMatterWorkspaceLinks", () => {
  it("exposes five top-level hubs and grouped More tools", () => {
    const links = getMatterWorkspaceLinks("matter-1", (key) => key)
    const hrefs = links.map((link) => link.href)
    const primaryLabels = links
      .filter((link) => link.group === "primary")
      .map((link) => link.label)
    const groupedLabels = (group: (typeof links)[number]["group"]) =>
      links.filter((link) => link.group === group).map((link) => link.label)

    expect(primaryLabels).toEqual(["Overview", "Documents", "Work", "Draft", "Research"])
    expect(hrefs).toContain("/app/matters/matter-1/work")
    expect(hrefs).toContain("/app/matters/matter-1/draft")
    expect(hrefs).toContain("/app/matters/matter-1/documents")
    expect(hrefs).toContain("/app/matters/matter-1/evidence-map")
    expect(groupedLabels("caseTools")).toEqual([
      "Strategy",
      "Outcome",
      "Opponent",
      "Similar cases",
      "Evidence",
      "Evidence map",
      "Quick AI",
    ])
    expect(groupedLabels("litigation")).toEqual(["Court"])
    expect(groupedLabels("peopleMoney")).toEqual(["Parties", "Billing"])
    expect(new Set(hrefs).size).toBe(hrefs.length)
  })

  it("matches overview exactly and nested destination routes by prefix", () => {
    const links = getMatterWorkspaceLinks("matter-1", (key) => key)
    const overview = links.find((link) => link.exact)!
    const documents = links.find((link) => link.href.endsWith("/documents"))!

    expect(isMatterWorkspaceLinkActive("/app/matters/matter-1", overview)).toBe(true)
    expect(isMatterWorkspaceLinkActive("/app/matters/matter-1/documents", overview)).toBe(false)
    expect(isMatterWorkspaceLinkActive("/app/matters/matter-1/documents/history", documents)).toBe(true)
  })

  it("maps legacy task and meeting routes to Work", () => {
    const links = getMatterWorkspaceLinks("matter-1", (key) => key)
    const work = links.find((link) => link.href.endsWith("/work"))!

    expect(isMatterWorkspaceLinkActive("/app/matters/matter-1/work", work)).toBe(true)
    expect(isMatterWorkspaceLinkActive("/app/matters/matter-1/work/queue", work)).toBe(true)
    expect(isMatterWorkspaceLinkActive("/app/matters/matter-1/tasks", work)).toBe(true)
    expect(isMatterWorkspaceLinkActive("/app/matters/matter-1/tasks/task-1", work)).toBe(true)
    expect(isMatterWorkspaceLinkActive("/app/matters/matter-1/meetings", work)).toBe(true)
    expect(isMatterWorkspaceLinkActive("/app/matters/matter-1/meetings/meeting-1", work)).toBe(true)
    expect(isMatterWorkspaceLinkActive("/app/matters/matter-1/workbench", work)).toBe(false)
    const quickAi = links.find((link) => link.href.endsWith("/workbench"))!
    expect(isMatterWorkspaceLinkActive("/app/matters/matter-1/workbench", quickAi)).toBe(true)
  })

  it("maps compatibility routes to their canonical hubs without prefix collisions", () => {
    const links = getMatterWorkspaceLinks("matter-1", (key) => key)
    const documents = links.find((link) => link.href.endsWith("/documents"))!
    const quickAi = links.find((link) => link.href.endsWith("/workbench"))!
    const research = links.find((link) => link.href.endsWith("/workspace"))!

    expect(isMatterWorkspaceLinkActive("/app/matters/matter-1/diligence", documents)).toBe(true)
    expect(isMatterWorkspaceLinkActive("/app/matters/matter-1/ai", quickAi)).toBe(true)
    expect(isMatterWorkspaceLinkActive("/app/matters/matter-1/workspace", research)).toBe(true)
    expect(isMatterWorkspaceLinkActive("/app/matters/matter-1/workspaces", research)).toBe(false)
  })
})
