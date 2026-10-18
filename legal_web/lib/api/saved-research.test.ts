import { beforeEach, describe, expect, it, vi } from "vitest"
import { apiFetch } from "./client"
import {
  getSavedResearch,
  listSavedResearch,
  researchResultFromSaved,
  saveResearchToClient,
} from "./ai"

vi.mock("./client", () => ({
  apiFetch: vi.fn(),
}))

describe("saved research API", () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset()
  })

  it("scopes list requests to client and matter", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce([])
    await listSavedResearch("tenant-1", {
      clientId: "client-1",
      matterId: "matter-1",
    })
    expect(apiFetch).toHaveBeenCalledWith(
      "/ai/research/saved?clientId=client-1&matterId=matter-1",
      { tenantId: "tenant-1" },
    )
  })

  it("uses the saved research detail endpoint for openable records", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ id: "saved-1" })
    await getSavedResearch("saved-1", "tenant-1")
    expect(apiFetch).toHaveBeenCalledWith(
      "/ai/research/saved/saved-1",
      { tenantId: "tenant-1" },
    )
  })

  it("saves the selected client and matter without calling promotion", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ id: "saved-1" })
    const payload = {
      clientId: "client-1",
      matterId: "matter-1",
      title: "Memo",
      query: "Question",
      researchJson: { answer: "Answer" },
    }
    await saveResearchToClient(payload, "tenant-1")
    expect(apiFetch).toHaveBeenCalledTimes(1)
    expect(apiFetch).toHaveBeenCalledWith("/ai/research/saved", {
      method: "POST",
      body: payload,
      tenantId: "tenant-1",
    })
  })

  it("rehydrates a firm-filed record for the research screen", () => {
    const result = researchResultFromSaved({
      id: "saved-1",
      clientId: "client-1",
      title: "Memo",
      query: "Question",
      createdAt: "2026-07-27T08:00:00.000Z",
      aiOutputId: "output-1",
      countryCode: "IN",
      researchJson: {
        answer: "Filed memo",
        citations: [{ title: "Authority", source: "Reporter" }],
        publicationState: "DRAFT_NOT_VERIFIED",
      },
    })
    expect(result.answer).toBe("Filed memo")
    expect(result.aiOutputId).toBe("output-1")
    expect(result.publicationState).toBe("DRAFT_NOT_VERIFIED")
    expect(result.fromCache).toBe(true)
  })
})
