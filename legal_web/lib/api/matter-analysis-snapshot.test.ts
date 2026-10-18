import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("./client", () => ({
  apiFetch: vi.fn(),
}))

import { apiFetch } from "./client"
import {
  getLatestMatterAnalysis,
  normalizeMatterAnalysisSnapshot,
  runMatterAnalysis,
  type MatterAnalysisSnapshot,
} from "./matter-analysis-snapshot"

const baseSnapshot: MatterAnalysisSnapshot = {
  id: "snap-1",
  matterId: "matter-1",
  status: "COMPLETED",
  scope: "full",
  summary: "Summary text",
  risks: ["Risk A"],
  nextActions: ["Action A"],
  evidenceGaps: ["Gap A"],
  contradictions: ["Contradiction A"],
  sourceDocumentCount: 2,
  createdAt: "2026-07-28T00:00:00.000Z",
}

describe("normalizeMatterAnalysisSnapshot", () => {
  it("returns null for nullish input", () => {
    expect(normalizeMatterAnalysisSnapshot(null)).toBeNull()
    expect(normalizeMatterAnalysisSnapshot(undefined)).toBeNull()
  })

  it("coerces missing array fields to empty arrays", () => {
    const normalized = normalizeMatterAnalysisSnapshot({
      ...baseSnapshot,
      risks: undefined as unknown as string[],
      nextActions: null as unknown as string[],
      evidenceGaps: undefined as unknown as string[],
      contradictions: null as unknown as string[],
    })

    expect(normalized).toEqual({
      ...baseSnapshot,
      risks: [],
      nextActions: [],
      evidenceGaps: [],
      contradictions: [],
    })
  })

  it("filters non-string and blank entries", () => {
    const normalized = normalizeMatterAnalysisSnapshot({
      ...baseSnapshot,
      risks: ["  Risk A  ", "", 42, null] as unknown as string[],
      nextActions: ["Action A"],
      evidenceGaps: ["Gap A"],
      contradictions: ["Contradiction A"],
    })

    expect(normalized?.risks).toEqual(["Risk A"])
  })

  it("passes through valid arrays unchanged", () => {
    expect(normalizeMatterAnalysisSnapshot(baseSnapshot)).toEqual(baseSnapshot)
  })
})

describe("matter analysis snapshot API", () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset()
  })

  it("normalizes latest snapshot responses", async () => {
    vi.mocked(apiFetch).mockResolvedValue({
      ...baseSnapshot,
      risks: undefined,
      nextActions: null,
      evidenceGaps: undefined,
      contradictions: null,
    })

    const result = await getLatestMatterAnalysis("tenant-1", "matter-1")

    expect(result).toEqual({
      ...baseSnapshot,
      risks: [],
      nextActions: [],
      evidenceGaps: [],
      contradictions: [],
    })
  })

  it("normalizes run snapshot responses", async () => {
    vi.mocked(apiFetch).mockResolvedValue({
      ...baseSnapshot,
      evidenceGaps: undefined,
    })

    const result = await runMatterAnalysis("tenant-1", "matter-1")

    expect(result.evidenceGaps).toEqual([])
  })
})
