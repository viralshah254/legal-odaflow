import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("./client", () => ({
  apiFetch: vi.fn(),
  ApiClientError: class ApiClientError extends Error {
    statusCode: number
    body: unknown
    constructor(message: string, statusCode: number, body?: unknown) {
      super(message)
      this.name = "ApiClientError"
      this.statusCode = statusCode
      this.body = body
    }
  },
}))

import { apiFetch } from "./client"
import {
  appendResearchWorkspaceContext,
  createResearchWorkspace,
  getResearchWorkspace,
  listResearchWorkspaceRevisions,
  updateResearchWorkspace,
} from "./research-workspaces"

describe("research workspace API", () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset()
    vi.mocked(apiFetch).mockResolvedValue({})
  })

  it("creates a matter-scoped deep research workspace", async () => {
    const input = {
      objective: "Assess whether the notice was valid",
      title: "Notice validity",
      jurisdiction: "IN",
      region: "Delhi",
      matterId: "matter-1",
      mode: "deep" as const,
    }

    await createResearchWorkspace("tenant-1", input)

    expect(apiFetch).toHaveBeenCalledWith("/research/workspaces", {
      method: "POST",
      tenantId: "tenant-1",
      body: input,
    })
  })

  it("gets a workspace and lists its AI output revisions", async () => {
    await getResearchWorkspace("tenant-1", "workspace-1")
    await listResearchWorkspaceRevisions("tenant-1", "workspace-1")

    expect(apiFetch).toHaveBeenNthCalledWith(
      1,
      "/research/workspaces/workspace-1",
      { tenantId: "tenant-1" },
    )
    expect(apiFetch).toHaveBeenNthCalledWith(
      2,
      "/research/workspaces/workspace-1/revisions",
      { tenantId: "tenant-1" },
    )
  })

  it("appends structured context at the expected revision", async () => {
    const input = {
      expectedRevision: 2,
      kind: "evidence" as const,
      label: "Answer to open question",
      content: {
        text: "The notice was served on 2 July.",
        questionId: "question-1",
      },
      provenance: {
        sourceType: "matter",
        sourceId: "matter-1",
        capturedAt: "2026-07-27T00:00:00.000Z",
      },
      affectedIssueIds: ["notice"],
    }

    await appendResearchWorkspaceContext("tenant-1", "workspace-1", input)

    expect(apiFetch).toHaveBeenCalledWith(
      "/research/workspaces/workspace-1/context",
      {
        method: "POST",
        tenantId: "tenant-1",
        body: input,
      },
    )
  })

  it("links a new AI output using optimistic workspace revision", async () => {
    const input = {
      expectedRevision: 3,
      status: "completed" as const,
      revision: {
        aiOutputId: "output-2",
        affectedIssueIds: ["notice"],
        provenance: { action: "follow-up", questionId: "question-1" },
      },
    }

    await updateResearchWorkspace("tenant-1", "workspace-1", input)

    expect(apiFetch).toHaveBeenCalledWith("/research/workspaces/workspace-1", {
      method: "PATCH",
      tenantId: "tenant-1",
      body: input,
    })
  })

  it("persists question context, links the answer revision, and reloads both revisions", async () => {
    vi.mocked(apiFetch)
      .mockResolvedValueOnce({
        id: "workspace-1",
        revision: 1,
        contextItems: [],
      })
      .mockResolvedValueOnce({
        item: { id: "context-1", ordinal: 1 },
        workspaceRevision: 2,
      })
      .mockResolvedValueOnce({
        id: "workspace-1",
        revision: 3,
        contextItems: [{ id: "context-1" }],
      })
      .mockResolvedValueOnce([
        { id: "revision-1", revision: 1, aiOutputId: "output-1" },
        { id: "revision-2", revision: 2, aiOutputId: "output-2" },
      ])

    const workspace = await getResearchWorkspace("tenant-1", "workspace-1")
    const appended = await appendResearchWorkspaceContext(
      "tenant-1",
      "workspace-1",
      {
        expectedRevision: workspace.revision,
        kind: "fact",
        label: "Answer to open question",
        content: { questionId: "question-1", answered: true },
        provenance: {
          sourceType: "research_question",
          sourceId: "question-1",
        },
        affectedIssueIds: ["cruelty"],
      },
    )
    await updateResearchWorkspace("tenant-1", "workspace-1", {
      expectedRevision: appended.workspaceRevision,
      status: "completed",
      revision: {
        aiOutputId: "output-2",
        affectedIssueIds: ["cruelty"],
        provenance: { action: "answer", questionId: "question-1" },
      },
    })
    const revisions = await listResearchWorkspaceRevisions(
      "tenant-1",
      "workspace-1",
    )

    expect(apiFetch).toHaveBeenNthCalledWith(
      2,
      "/research/workspaces/workspace-1/context",
      expect.objectContaining({
        method: "POST",
        body: expect.objectContaining({
          expectedRevision: 1,
          content: expect.objectContaining({ questionId: "question-1" }),
        }),
      }),
    )
    expect(apiFetch).toHaveBeenNthCalledWith(
      3,
      "/research/workspaces/workspace-1",
      expect.objectContaining({
        method: "PATCH",
        body: expect.objectContaining({
          expectedRevision: 2,
          revision: expect.objectContaining({ aiOutputId: "output-2" }),
        }),
      }),
    )
    expect(revisions).toHaveLength(2)
  })
})
