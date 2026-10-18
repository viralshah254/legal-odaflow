import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("./events", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./events")>()
  return { ...actual, trackEvent: vi.fn() }
})

import { AnalyticsEvents, trackEvent } from "./events"
import { buildResearchTelemetry, trackResearchEvent } from "./research-events"

describe("research product telemetry", () => {
  beforeEach(() => vi.mocked(trackEvent).mockReset())

  it("captures only the event-specific privacy-safe allowlist", () => {
    const properties = buildResearchTelemetry(
      AnalyticsEvents.RESEARCH_REVISION_COMPLETED,
      {
        workspaceId: "workspace-1",
        aiOutputId: "output-2",
        revision: 3,
        mode: "deep",
        affectedIssueCount: 2,
        query: "private legal question",
        sourceUrl: "https://court.example/private",
      } as never,
    )

    expect(properties).toEqual({
      workspaceId: "workspace-1",
      aiOutputId: "output-2",
      revision: 3,
      mode: "deep",
      affectedIssueCount: 2,
    })
    expect(JSON.stringify(properties)).not.toMatch(/private|sourceUrl|query/)
  })

  it("normalizes elapsed time and forwards no legal content", () => {
    trackResearchEvent(AnalyticsEvents.RESEARCH_LAWYER_DECISION_TIME, {
      aiOutputId: "output-1",
      citationTaskId: "task-1",
      decision: "REJECT",
      elapsedMs: 1234.8,
    })

    expect(trackEvent).toHaveBeenCalledWith(
      AnalyticsEvents.RESEARCH_LAWYER_DECISION_TIME,
      {
        aiOutputId: "output-1",
        citationTaskId: "task-1",
        decision: "REJECT",
        elapsedMs: 1235,
      },
    )
  })

  it("marks unsafe copy/export without memo, passage, URL, or names", () => {
    expect(
      buildResearchTelemetry(AnalyticsEvents.RESEARCH_UNSAFE_EXPORT_ATTEMPT, {
        aiOutputId: "output-1",
        action: "copy",
        outcome: "watermarked",
        safeForReliance: false,
      }),
    ).toEqual({
      aiOutputId: "output-1",
      action: "copy",
      outcome: "watermarked",
      safeForReliance: false,
    })
  })
})
