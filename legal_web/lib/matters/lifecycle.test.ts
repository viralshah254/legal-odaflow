import { describe, expect, it } from "vitest"
import {
  MATTER_STAGE_OPTIONS,
  MATTER_STATUS_OPTIONS,
  normalizeMatterStage,
  normalizeMatterStatus,
} from "./lifecycle"

describe("matter lifecycle display compatibility", () => {
  it.each([
    ["Active", "OPEN"],
    ["open", "OPEN"],
    ["On Hold", "ON_HOLD"],
    ["archived", "ARCHIVED"],
  ])("maps legacy status %s to %s", (input, expected) => {
    expect(normalizeMatterStatus(input)).toBe(expected)
  })

  it("maps known stages and preserves unknown legacy stages", () => {
    expect(normalizeMatterStage("DISCOVERY")).toBe("Discovery")
    expect(normalizeMatterStage("pre-trial")).toBe("pre-trial")
    expect(MATTER_STAGE_OPTIONS).toContain("Closing")
    expect(MATTER_STATUS_OPTIONS).toContain("ON_HOLD")
  })
})
