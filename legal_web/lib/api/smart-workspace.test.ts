import { beforeEach, describe, expect, it, vi } from "vitest"
import { apiFetch } from "./client"
import {
  addDocumentToWorkspace,
  getOrCreateMatterWorkspace,
  listCanvasNodes,
} from "./smart-workspace"

vi.mock("./client", () => ({
  apiFetch: vi.fn(),
}))

describe("smart-workspace API", () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset()
  })

  it("passes tenantId when loading a matter workspace", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ id: "ws-1", workspaceDocs: [] })
    await getOrCreateMatterWorkspace("tenant-1", "matter-1")
    expect(apiFetch).toHaveBeenCalledWith("/matters/matter-1/smart-workspace", {
      tenantId: "tenant-1",
    })
  })

  it("passes tenantId when listing canvas nodes", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce([])
    await listCanvasNodes("tenant-1", "ws-1")
    expect(apiFetch).toHaveBeenCalledWith("/smart-workspaces/ws-1/canvas-nodes", {
      tenantId: "tenant-1",
    })
  })

  it("passes tenantId when adding a document to a workspace", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ id: "wd-1" })
    await addDocumentToWorkspace("tenant-1", "ws-1", "doc-1")
    expect(apiFetch).toHaveBeenCalledWith("/smart-workspaces/ws-1/documents", {
      method: "POST",
      body: JSON.stringify({ documentId: "doc-1" }),
      tenantId: "tenant-1",
    })
  })
})
