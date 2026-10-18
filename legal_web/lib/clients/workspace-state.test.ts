import { describe, expect, it } from "vitest"
import {
  buildClientTabHref,
  getKycCompletionPercent,
  resolveClientTab,
  riskFromScore,
} from "./workspace-state"

describe("client workspace state", () => {
  it("resolves supported tabs and defaults unknown deep links to overview", () => {
    expect(resolveClientTab("kyc")).toBe("kyc")
    expect(resolveClientTab("documents")).toBe("documents")
    expect(resolveClientTab("people")).toBe("overview")
    expect(resolveClientTab(null)).toBe("overview")
  })

  it("builds deep links while preserving unrelated query parameters", () => {
    expect(buildClientTabHref("client-1", "documents", "source=alert")).toBe(
      "/app/clients/client-1?source=alert&tab=documents",
    )
    expect(buildClientTabHref("client-1", "overview", "tab=kyc&source=alert")).toBe(
      "/app/clients/client-1?source=alert",
    )
  })

  it("uses verified documents only for completion percentage", () => {
    const documents = [
      { id: "1", docType: "OTHER" as const, status: "VERIFIED" as const },
      { id: "2", docType: "OTHER" as const, status: "RECEIVED" as const },
      { id: "3", docType: "OTHER" as const, status: "EXPIRED" as const },
    ]
    expect(getKycCompletionPercent(documents)).toBe(33)
    expect(getKycCompletionPercent()).toBe(0)
  })

  it.each([
    [null, "Low"],
    [34, "Low"],
    [35, "Medium"],
    [60, "High"],
    [80, "Critical"],
  ] as const)("maps risk score %s to %s", (score, expected) => {
    expect(riskFromScore(score)).toBe(expected)
  })
})
