import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("./client", () => ({
  apiFetch: vi.fn(),
  buildAuthHeaders: vi.fn(),
  ApiClientError: class ApiClientError extends Error {},
}))

import { apiFetch } from "./client"
import { exportIndiaDraft, fetchDraftJobResult, linkDraftToClient } from "./india-drafting"

describe("India drafting persistence API", () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset()
  })

  it("maps a v3 result to the durable CourtDraftRecord draftId", async () => {
    vi.mocked(apiFetch).mockResolvedValue({
      jobId: "job-1",
      draftId: "draft-1",
      courtDraftRecordId: "draft-1",
      status: "ready",
      assembledDraft: { fullText: "Durable draft", citationAppendix: [] },
      verificationReport: null,
      sections: [],
      totalCostUsd: 1,
      completedAt: "2026-07-27T00:00:00.000Z",
    })

    await expect(fetchDraftJobResult("job-1", "tenant-1")).resolves.toEqual(
      expect.objectContaining({
        draft: "Durable draft",
        draftId: "draft-1",
        engineVersion: "v3",
      }),
    )
  })

  it("sends the dependent matter when linking a draft", async () => {
    vi.mocked(apiFetch).mockResolvedValue({ success: true })

    await linkDraftToClient(
      "draft-1",
      { clientId: "client-1", matterId: "matter-1", clientName: "Acme" },
      "tenant-1",
    )

    expect(apiFetch).toHaveBeenCalledWith("/ai/drafts/draft-1/link-to-client", {
      method: "PATCH",
      tenantId: "tenant-1",
      body: {
        clientId: "client-1",
        matterId: "matter-1",
        clientName: "Acme",
      },
    })
  })

  it("routes filing exports through the authenticated backend gate", async () => {
    vi.mocked(apiFetch).mockResolvedValue({ html: "<html>approved</html>" })

    await exportIndiaDraft(
      {
        documentKind: "india_bail_application",
        html: "client text",
        fileName: "Bail application",
        format: "pdf",
        draftId: "draft-1",
        exportMode: "filing",
      },
      "tenant-1",
    )

    expect(apiFetch).toHaveBeenCalledWith("/ai/india-draft/export", {
      method: "POST",
      tenantId: "tenant-1",
      body: expect.objectContaining({
        draftId: "draft-1",
        exportMode: "filing",
        format: "pdf",
      }),
    })
  })
})
