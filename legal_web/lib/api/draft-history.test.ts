import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("./client", () => ({ apiFetch: vi.fn() }))

import { apiFetch } from "./client"
import { updateSavedDraft } from "./draft-history"

describe("saved draft persistence API", () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset()
    vi.mocked(apiFetch).mockResolvedValue({})
  })

  it("persists the current editable draft text", async () => {
    await updateSavedDraft(
      "draft-1",
      { draftText: "Draft with completed blank values" },
      "tenant-1",
    )

    expect(apiFetch).toHaveBeenCalledWith("/ai/drafts/draft-1", {
      method: "PATCH",
      tenantId: "tenant-1",
      body: { draftText: "Draft with completed blank values" },
    })
  })
})
