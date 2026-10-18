import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("./client", () => ({ apiFetch: vi.fn() }))

import { apiFetch } from "./client"
import {
  getCitationReviews,
  submitCitationReviewDecision,
} from "./citation-reviews"

describe("citation review API", () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset()
    vi.mocked(apiFetch).mockResolvedValue({})
  })

  it("fetches and materializes review tasks for an output", async () => {
    await getCitationReviews("output-1", "tenant-1")

    expect(apiFetch).toHaveBeenCalledWith(
      "/ai/research/output-1/citation-reviews",
      { tenantId: "tenant-1" },
    )
  })

  it("submits the task version and passage evidence", async () => {
    const input = {
      decision: "APPROVE" as const,
      reviewerNote: "Confirmed against the official judgment.",
      expectedVersion: 3,
      sourceUrl: "https://court.example/judgment",
      sourceHash: "a".repeat(64),
      exactPassage: "This is the exact supporting passage.",
      pinpoint: "para 42",
      evidenceKind: "PASSAGE" as const,
    }

    await submitCitationReviewDecision(
      "output-1",
      "task-1",
      "tenant-1",
      input,
    )

    expect(apiFetch).toHaveBeenCalledWith(
      "/ai/research/output-1/citation-reviews/task-1/decision",
      {
        method: "POST",
        tenantId: "tenant-1",
        body: input,
      },
    )
  })
})
