import type { CountryCode, UrgencyLevel } from "@/lib/api/types"

/** Wizard has four steps; labels come from `useIssueCheckerLabels()`. */
export const ISSUE_CHECKER_STEP_COUNT = 4

/** Full-width wrapping rows — pills collapse to a vertical column on tablet. */
export const INTAKE_OUTCOME_ROW_CLASSES =
  "flex w-full min-w-0 items-start gap-2 rounded-lg border px-3 py-2 text-left text-sm font-medium whitespace-normal break-words transition-colors"

export type IssueCheckerMode = "SELF" | "FIRM_INTAKE"

export interface IssueCheckerWizardData {
  countryCode: CountryCode
  jurisdiction: string
  issueType: string
  title: string
  facts: string
  urgencyLevel: UrgencyLevel
  parties: string
  desiredOutcome: string
  clientName: string
  clientId?: string
  clientReference: string
  internalNotes: string
  /** Answers collected during AI planning/clarification phase. Multi-select answers stored as arrays. */
  planningAnswers?: Record<string, string | string[]>
}
export const ISSUE_CHECKER_SESSION_KEY = "legal_issue_checker_session"

export function createEmptyWizardData(countryCode: CountryCode): IssueCheckerWizardData {
  return {
    countryCode,
    jurisdiction: "",
    issueType: "",
    title: "",
    facts: "",
    urgencyLevel: "MEDIUM",
    parties: "",
    desiredOutcome: "",
    clientName: "",
    clientReference: "",
    internalNotes: "",
  }
}

export interface IssueCheckerSessionState {
  step: number
  mode: IssueCheckerMode
  data: IssueCheckerWizardData
  anonymousSessionId?: string
  pendingAttach?: boolean
  teaserGenerated?: boolean
  /** Set by LandingIssueBoard; wizard applies session and advances without redundant classify when possible. */
  landingHandoff?: boolean
}

export function loadIssueCheckerSession(): IssueCheckerSessionState | null {
  if (typeof window === "undefined") return null
  const raw = sessionStorage.getItem(ISSUE_CHECKER_SESSION_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as IssueCheckerSessionState
  } catch {
    return null
  }
}

export function saveIssueCheckerSession(state: IssueCheckerSessionState): void {
  if (typeof window === "undefined") return
  sessionStorage.setItem(ISSUE_CHECKER_SESSION_KEY, JSON.stringify(state))
}

export function clearIssueCheckerSession(): void {
  if (typeof window === "undefined") return
  sessionStorage.removeItem(ISSUE_CHECKER_SESSION_KEY)
}
