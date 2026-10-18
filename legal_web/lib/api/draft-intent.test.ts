import { describe, expect, it } from "vitest"
import {
  defaultDraftBundleKinds,
  hasBlockingClarification,
  unresolvedRouteBlockers,
  type DraftIntentBundleItem,
  type DraftIntentCuratedDraftMatch,
  type DraftRouteDecision,
} from "./draft-intent"

const match = (
  kind: string,
  filingRole?: DraftIntentCuratedDraftMatch["filingRole"],
): DraftIntentCuratedDraftMatch => ({
  type: "curated_draft",
  confidence: 0.95,
  summary: kind,
  kind,
  label: kind,
  countryCode: "IN",
  draftUrl: `/draft/${kind}`,
  bundleRecommended: true,
  filingRole,
})

const bundleItem = (
  kind: string,
  filingRole?: DraftIntentBundleItem["filingRole"],
): DraftIntentBundleItem => ({
  kind,
  label: kind,
  documentKind: kind,
  order: 1,
  selectedByDefault: true,
  filingRole,
})

describe("draft-intent procedural UI rules", () => {
  it("blocks drafting for unresolved route blockers and required questions", () => {
    const route: DraftRouteDecision = {
      jurisdiction: "IN",
      practiceArea: "civil_commercial",
      subPracticeArea: "commercial_recovery",
      partyRole: "claimant",
      causeOfAction: "unpaid invoices",
      claimBasis: "written contract",
      proceedingType: "summary_suit",
      documentKind: "plaint",
      draftKind: "india_suit_recovery_cpc_37",
      forum: "Commercial Court",
      courtLevel: "district",
      territorialBasis: [],
      mandatoryPreFilingSteps: [],
      confidence: "medium",
      reasons: ["Written invoices support summary procedure."],
      blockingIssues: [
        { id: "forum", field: "forum", message: "Confirm the competent Commercial Court" },
      ],
      primaryDocumentLabel: "Order XXXVII summary suit",
      supportingDocumentLabels: ["Statement of Truth"],
    }

    expect(unresolvedRouteBlockers(route)).toHaveLength(1)
    expect(hasBlockingClarification(route, [], {})).toBe(true)
    expect(
      hasBlockingClarification(
        { ...route, blockingIssues: [] },
        [{ id: "section_12a", blocking: true }],
        {},
      ),
    ).toBe(true)
    expect(
      hasBlockingClarification(
        { ...route, blockingIssues: [] },
        [{ id: "section_12a", blocking: true }],
        { section_12a: "urgent interim relief is sought" },
      ),
    ).toBe(false)
  })

  it("preselects only primary and required supporting filings", () => {
    const bundle = [
      bundleItem("summary_suit", "primary"),
      bundleItem("statement_of_truth", "required_supporting"),
      bundleItem("generic_petition", "unrelated"),
      bundleItem("counterclaim", "opposing_party"),
      bundleItem("optional_affidavit", "optional_supporting"),
    ]
    const matches = [
      match("summary_suit", "primary"),
      match("statement_of_truth", "required_supporting"),
      match("generic_petition", "unrelated"),
      match("counterclaim", "opposing_party"),
      match("optional_affidavit", "optional_supporting"),
    ]

    expect([...defaultDraftBundleKinds(bundle, matches)]).toEqual([
      "summary_suit",
      "statement_of_truth",
    ])
  })

  it("uses the resolved filing set to reject unrelated legacy defaults", () => {
    const route: DraftRouteDecision = {
      jurisdiction: "IN",
      practiceArea: "civil_commercial",
      subPracticeArea: "commercial_recovery",
      partyRole: "claimant",
      causeOfAction: "unpaid invoices",
      claimBasis: "written contract",
      proceedingType: "summary_suit",
      documentKind: "plaint",
      draftKind: "summary_suit",
      forum: "Commercial Court",
      courtLevel: "district",
      territorialBasis: [],
      mandatoryPreFilingSteps: [],
      confidence: "high",
      reasons: [],
      blockingIssues: [],
      primaryDocumentLabel: "summary_suit",
      supportingDocumentLabels: ["statement_of_truth"],
    }

    expect([
      ...defaultDraftBundleKinds(
        [bundleItem("summary_suit"), bundleItem("generic_petition")],
        [match("summary_suit"), match("generic_petition")],
        route,
      ),
    ]).toEqual(["summary_suit"])
  })

  it("keeps legacy primary bundle defaults compatible", () => {
    expect([
      ...defaultDraftBundleKinds(
        [bundleItem("legacy_primary")],
        [match("legacy_primary")],
      ),
    ]).toEqual(["legacy_primary"])
  })
})
