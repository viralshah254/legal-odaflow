import { describe, expect, it } from "vitest"
import { INTAKE_OUTCOME_ROW_CLASSES } from "./constants"

describe("intake outcome option rows", () => {
  it("uses full-width wrapping rows instead of shrinking pills", () => {
    expect(INTAKE_OUTCOME_ROW_CLASSES).toContain("w-full")
    expect(INTAKE_OUTCOME_ROW_CLASSES).toContain("break-words")
    expect(INTAKE_OUTCOME_ROW_CLASSES).toContain("whitespace-normal")
    expect(INTAKE_OUTCOME_ROW_CLASSES).not.toContain("rounded-full")
  })
})
