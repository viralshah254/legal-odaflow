import { describe, expect, it } from "vitest"
import {
  buildLegacyWorkRedirect,
  buildWorkHubHref,
  resolveWorkHubView,
} from "./work-hub-state"

describe("matter work hub routing", () => {
  it("resolves only supported views", () => {
    expect(resolveWorkHubView(null)).toBe("tasks")
    expect(resolveWorkHubView("meetings")).toBe("meetings")
    expect(resolveWorkHubView("notes")).toBe("notes")
    expect(resolveWorkHubView("activity")).toBe("activity")
    expect(resolveWorkHubView("unknown")).toBe("tasks")
  })

  it("builds canonical URLs while retaining unrelated query state", () => {
    expect(buildWorkHubHref("matter-1", "notes", "source=overview")).toBe(
      "/app/matters/matter-1/work?source=overview&view=notes",
    )
    expect(buildWorkHubHref("matter-1", "tasks", "view=activity&highlight=task-1")).toBe(
      "/app/matters/matter-1/work?highlight=task-1",
    )
    expect(buildWorkHubHref("matter-1", "meetings")).toBe(
      "/app/matters/matter-1/work?view=meetings",
    )
    expect(buildWorkHubHref("matter-1", "activity", "view=notes")).toBe(
      "/app/matters/matter-1/work?view=activity",
    )
  })

  it("moves useful legacy parameters to matter-scoped work URLs", () => {
    expect(
      buildLegacyWorkRedirect("meetings", "matterId=matter-1&clientId=client-1&page=2"),
    ).toBe("/app/matters/matter-1/work?clientId=client-1&page=2&view=meetings")
    expect(buildLegacyWorkRedirect("tasks", "highlight=task-1", "matter-1")).toBe(
      "/app/matters/matter-1/work?highlight=task-1",
    )
  })

  it("returns unscoped legacy traffic to matter selection", () => {
    expect(buildLegacyWorkRedirect("tasks", "highlight=task-1")).toBe(
      "/app/matters?highlight=task-1&workView=tasks",
    )
  })
})
