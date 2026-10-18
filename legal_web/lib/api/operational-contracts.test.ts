import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("./client", () => ({ apiFetch: vi.fn() }))

import { apiFetch } from "./client"
import { archiveTenantDocument } from "./documents"
import { removeMatterShare, updateMatterShareAccess } from "./matter-access"
import { listLegalTimelineEvents } from "./matter-intelligence"
import { queryKeys } from "./query-keys"

describe("operational client and matter contracts", () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset()
    vi.mocked(apiFetch).mockResolvedValue({})
  })

  it("uses userId for both access updates and revocation", async () => {
    await updateMatterShareAccess("tenant-1", "matter-1", "user-1", "WRITE")
    await removeMatterShare("tenant-1", "matter-1", "user-1")

    expect(apiFetch).toHaveBeenNthCalledWith(
      1,
      "/matters/matter-1/access/user-1",
      expect.objectContaining({ method: "PATCH" }),
    )
    expect(apiFetch).toHaveBeenNthCalledWith(
      2,
      "/matters/matter-1/access/user-1",
      expect.objectContaining({ method: "DELETE" }),
    )
  })

  it("archives through the persisted document status contract", async () => {
    await archiveTenantDocument("tenant-1", "document-1")

    expect(apiFetch).toHaveBeenCalledWith(
      "/documents/document-1",
      expect.objectContaining({
        method: "PATCH",
        body: { status: "ARCHIVED" },
      }),
    )
  })

  it("keeps legal and operational timelines distinct", async () => {
    await listLegalTimelineEvents("tenant-1", "matter-1")

    expect(apiFetch).toHaveBeenCalledWith(
      "/matter-intelligence/v2/matters/matter-1/legal-timeline",
      { tenantId: "tenant-1" },
    )
    expect(queryKeys.matters.legalTimeline("tenant-1", "matter-1")).not.toEqual(
      queryKeys.matters.operationalTimeline("tenant-1", "matter-1"),
    )
  })

  it("uses canonical tenant-scoped keys for client and matter resources", () => {
    expect(queryKeys.clients.documents("tenant-1", "client-1")).toEqual([
      "clients",
      "detail",
      "tenant-1",
      "client-1",
      "documents",
    ])
    expect(queryKeys.matters.documents("tenant-1", "matter-1")).toEqual([
      "matters",
      "detail",
      "tenant-1",
      "matter-1",
      "documents",
    ])
    expect(queryKeys.clients.detail("tenant-1", "client-1")).not.toEqual(
      queryKeys.clients.detail("tenant-2", "client-1"),
    )
  })
})
