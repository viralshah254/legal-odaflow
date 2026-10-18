import { execFileSync } from "node:child_process"
import { describe, expect, it } from "vitest"
import {
  buildCitationReviewDecision,
  citationTaskFailureReasons,
  findManualCitationTask,
  manualReviewStateFromCitationReviews,
  validateCitationReviewForm,
} from "@/components/research/citation-review-dialog.helpers"
import type {
  CitationReviewState,
  ManualCitationReviewTask,
} from "@/lib/api/citation-reviews"

const task: ManualCitationReviewTask = {
  id: "task-1",
  tenantId: "tenant-1",
  aiOutputId: "output-1",
  citationKey: "key-1",
  citation: "Example v State [2026] SC 10",
  claim: "The remedy is available without proof of loss.",
  auditEntry: {
    authorityId: "authority-1",
    missingReasons: ["Exact passage was not retrieved"],
    checks: [
      { dimension: "identity", state: "PASS", reason: "Identity matched" },
      { dimension: "passage", state: "FAIL", reason: "Passage did not support the proposition" },
    ],
  },
  status: "pending",
  version: 2,
  createdAt: "2026-07-27T00:00:00.000Z",
  updatedAt: "2026-07-27T01:00:00.000Z",
}

describe("citation review dialog helpers", () => {
  it("matches the backend task and renders proposition, citation, and failure reasons", () => {
    const requested = {
      id: "authority-1",
      citation: task.citation,
      authorityId: "authority-1",
      supportState: "CHECKS_INCOMPLETE" as const,
      reasons: ["Exact passage was not retrieved"],
    }

    expect(findManualCitationTask([task], requested)?.id).toBe("task-1")
    expect(citationTaskFailureReasons(task, requested)).toEqual([
      "Exact passage was not retrieved",
      "Passage did not support the proposition",
    ])

    const script = `
      import { createElement } from "react";
      import { renderToStaticMarkup } from "react-dom/server";
      import { CitationReviewTaskDetails } from "./components/research/citation-review-dialog.tsx";
      const task = ${JSON.stringify(task)};
      const requestedTask = ${JSON.stringify(requested)};
      process.stdout.write(renderToStaticMarkup(
        createElement(CitationReviewTaskDetails, { task, requestedTask })
      ));
    `
    const html = execFileSync(
      process.execPath,
      ["--import", "tsx", "--input-type=module", "--eval", script],
      { cwd: process.cwd(), encoding: "utf8" },
    )
    expect(html).toContain("The remedy is available without proof of loss.")
    expect(html).toContain("Example v State [2026] SC 10")
    expect(html).toContain("Passage did not support the proposition")
  })

  it("requires full passage evidence for approval but only a note for rejection", () => {
    const incomplete = {
      decision: "APPROVE" as const,
      reviewerNote: "Checked",
      sourceUrl: "",
      sourceDocumentReference: "",
      sourceHash: "",
      exactPassage: "",
      pinpoint: "",
      replacementCitation: "",
    }
    expect(validateCitationReviewForm(incomplete)).toBe(
      "Enter a source URL or document reference.",
    )

    const rejection = { ...incomplete, decision: "REJECT" as const }
    expect(validateCitationReviewForm(rejection)).toBeNull()
    expect(buildCitationReviewDecision(rejection, 2)).toEqual({
      decision: "REJECT",
      reviewerNote: "Checked",
      expectedVersion: 2,
    })
  })

  it("maps manual completion separately without changing automated reliance", () => {
    const state: CitationReviewState = {
      tasks: [{ ...task, status: "approved", version: 3 }],
      reviews: [{
        id: "review-1",
        taskId: task.id,
        tenantId: task.tenantId,
        aiOutputId: task.aiOutputId,
        reviewerId: "lawyer-1",
        decision: "APPROVE",
        reviewerNote: "Confirmed",
        reviewedAt: "2026-07-27T02:00:00.000Z",
      }],
      summary: {
        total: 1,
        pending: 0,
        inReview: 0,
        approved: 1,
        rejected: 0,
        replaced: 0,
        decided: 1,
        complete: true,
        automatedCitationAuditUnchanged: true,
        safeForRelianceUnchanged: true,
      },
    }

    expect(manualReviewStateFromCitationReviews(state)).toEqual({
      status: "APPROVED",
      reviewedAt: "2026-07-27T02:00:00.000Z",
      note: "Confirmed",
    })
    expect(state.summary.safeForRelianceUnchanged).toBe(true)
  })
})
