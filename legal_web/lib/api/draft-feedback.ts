const BASE = process.env.NEXT_PUBLIC_API_URL ?? ""

export type FeedbackRating = "accepted" | "minor_edit" | "major_edit" | "rejected"

export const EDIT_CATEGORIES = [
  { id: "missing_citation", label: "Missing citation" },
  { id: "wrong_law", label: "Wrong law applied" },
  { id: "poor_structure", label: "Poor structure" },
  { id: "factual_error", label: "Factual error" },
  { id: "style", label: "Style / tone" },
  { id: "other", label: "Other" },
] as const

export type EditCategory = (typeof EDIT_CATEGORIES)[number]["id"]

export interface DraftFeedbackPayload {
  sectionType: string
  documentKind: string
  rating: FeedbackRating
  aiText: string
  userText?: string
  jurisdiction?: string
  editCategories?: EditCategory[]
  caseDetails?: string
  knownParties?: string[]
  courtDraftRecordId?: string
  draftSectionV3Id?: string
  draftJobSectionId?: string
}

/**
 * Submit feedback on a single AI-generated draft section.
 * Fire-and-forget: errors are logged but not thrown (non-critical).
 */
export async function submitSectionFeedback(payload: DraftFeedbackPayload): Promise<void> {
  try {
    await fetch(`${BASE}/api/drafts/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    })
  } catch {
    // Feedback submission is best-effort — don't surface errors to the user
  }
}

/**
 * Implicit feedback when the lawyer saves/exports an edited draft.
 * Backend derives rating from editRatio when userText differs from aiText.
 */
export async function submitImplicitEditFeedback(
  payload: Omit<DraftFeedbackPayload, "rating"> & { rating?: FeedbackRating },
): Promise<void> {
  const ai = payload.aiText ?? ""
  const user = payload.userText ?? ai
  if (!ai.trim() || ai === user) {
    // Unchanged — still record acceptance so the nightly pipeline sees positive signal
    await submitSectionFeedback({ ...payload, rating: payload.rating ?? "accepted" })
    return
  }
  await submitSectionFeedback({
    ...payload,
    rating: payload.rating ?? "minor_edit",
    userText: user,
  })
}
