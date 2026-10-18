import { describe, expect, it } from "vitest"
import {
  buildEvidenceCitationMap,
  evidenceIdFromAuthorityId,
  resolveEvidenceCitationLabel,
} from "./research-evidence-citations"

describe("research-evidence-citations", () => {
  it("derives evidence ids the same way as the backend evidence pack", () => {
    expect(evidenceIdFromAuthorityId("clabc123xyz")).toBe("EVD_CLABC123XYZ")
  })

  it("resolves framework evidence ids to citation labels", () => {
    const map = buildEvidenceCitationMap([
      {
        authorityId: "clabc123xyz",
        title: "Indian Contract Act, 1872",
        citation: "Indian Contract Act, 1872 s.10",
      },
    ])

    expect(resolveEvidenceCitationLabel("EVD_CLABC123XYZ", map)).toBe(
      "Indian Contract Act, 1872 s.10",
    )
    expect(resolveEvidenceCitationLabel("EVD_CLABC123XYZ_P1", map)).toBe(
      "Indian Contract Act, 1872 s.10",
    )
  })
})
