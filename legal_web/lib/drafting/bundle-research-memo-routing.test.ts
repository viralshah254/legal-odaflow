import { describe, expect, it } from "vitest"
import { resolveBundleResearchMemoKind, remapDraftUrlKind } from "@/lib/drafting/draft-navigation"

describe("resolveBundleResearchMemoKind", () => {
  it("routes medical consumer intake to india_consumer_research_memo", () => {
    const intake =
      "Medical negligence consumer complaint against hospital for laparoscopic gallbladder surgery and informed consent failure."
    expect(resolveBundleResearchMemoKind("india_legal_research_memo", intake)).toBe(
      "india_consumer_research_memo",
    )
  })

  it("keeps generic research memo for non-consumer intake", () => {
    expect(resolveBundleResearchMemoKind("india_legal_research_memo", "Contract interpretation issue")).toBe(
      "india_legal_research_memo",
    )
  })
})

describe("remapDraftUrlKind", () => {
  it("rewrites kind query param", () => {
    expect(
      remapDraftUrlKind("/app/india-drafting/draft?kind=india_legal_research_memo&label=Memo", "india_consumer_research_memo"),
    ).toBe("/app/india-drafting/draft?kind=india_consumer_research_memo&label=Memo")
  })
})
