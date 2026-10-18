import { describe, expect, it } from "vitest"
import { bundleStatusFromResolution } from "@/lib/drafting/draft-navigation"

describe("bundleStatusFromResolution", () => {
  it("maps clean/repaired to done (Ready)", () => {
    expect(bundleStatusFromResolution("clean")).toBe("done")
    expect(bundleStatusFromResolution("repaired")).toBe("done")
  })

  it("maps needs_user_confirmation to needs_confirm", () => {
    expect(bundleStatusFromResolution("needs_user_confirmation")).toBe("needs_confirm")
  })

  it("maps blocked and advocate review to blocked", () => {
    expect(bundleStatusFromResolution("blocked")).toBe("blocked")
    expect(bundleStatusFromResolution("needs_advocate_review")).toBe("blocked")
  })
})
