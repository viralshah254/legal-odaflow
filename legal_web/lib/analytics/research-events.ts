import { AnalyticsEvents, trackEvent } from "./events"

type ResearchEventPayloads = {
  [AnalyticsEvents.RESEARCH_REVISION_COMPLETED]: {
    workspaceId?: string
    aiOutputId?: string
    revision: number
    mode?: string
    affectedIssueCount?: number
  }
  [AnalyticsEvents.RESEARCH_QUESTION_ANSWERED]: {
    workspaceId?: string
    questionId?: string
    mode?: string
    affectedIssueCount?: number
  }
  [AnalyticsEvents.RESEARCH_CITATION_RESOLVED]: {
    aiOutputId?: string
    citationTaskId?: string
    decision: "APPROVE" | "REPLACE"
    elapsedMs?: number
  }
  [AnalyticsEvents.RESEARCH_CITATION_REJECTED]: {
    aiOutputId?: string
    citationTaskId?: string
    decision: "REJECT"
    elapsedMs?: number
  }
  [AnalyticsEvents.RESEARCH_LAWYER_DECISION_TIME]: {
    aiOutputId?: string
    citationTaskId?: string
    decision: "APPROVE" | "REPLACE" | "REJECT"
    elapsedMs: number
  }
  [AnalyticsEvents.RESEARCH_MATTER_CLIENT_FILED]: {
    aiOutputId?: string
    savedResearchId?: string
    clientId?: string
    matterId?: string
    destination: "client" | "matter"
    safeForReliance: boolean
  }
  [AnalyticsEvents.RESEARCH_DOCUMENT_FILED]: {
    aiOutputId?: string
    clientId?: string
    matterId?: string
    safeForReliance: boolean
  }
  [AnalyticsEvents.RESEARCH_UNSAFE_EXPORT_ATTEMPT]: {
    aiOutputId?: string
    action: "copy" | "pdf" | "docx" | "print"
    outcome: "blocked" | "watermarked"
    safeForReliance: false
  }
}

export type ResearchAnalyticsEvent = keyof ResearchEventPayloads

const ALLOWED_PROPERTIES: Record<ResearchAnalyticsEvent, readonly string[]> = {
  [AnalyticsEvents.RESEARCH_REVISION_COMPLETED]: [
    "workspaceId",
    "aiOutputId",
    "revision",
    "mode",
    "affectedIssueCount",
  ],
  [AnalyticsEvents.RESEARCH_QUESTION_ANSWERED]: [
    "workspaceId",
    "questionId",
    "mode",
    "affectedIssueCount",
  ],
  [AnalyticsEvents.RESEARCH_CITATION_RESOLVED]: [
    "aiOutputId",
    "citationTaskId",
    "decision",
    "elapsedMs",
  ],
  [AnalyticsEvents.RESEARCH_CITATION_REJECTED]: [
    "aiOutputId",
    "citationTaskId",
    "decision",
    "elapsedMs",
  ],
  [AnalyticsEvents.RESEARCH_LAWYER_DECISION_TIME]: [
    "aiOutputId",
    "citationTaskId",
    "decision",
    "elapsedMs",
  ],
  [AnalyticsEvents.RESEARCH_MATTER_CLIENT_FILED]: [
    "aiOutputId",
    "savedResearchId",
    "clientId",
    "matterId",
    "destination",
    "safeForReliance",
  ],
  [AnalyticsEvents.RESEARCH_DOCUMENT_FILED]: [
    "aiOutputId",
    "clientId",
    "matterId",
    "safeForReliance",
  ],
  [AnalyticsEvents.RESEARCH_UNSAFE_EXPORT_ATTEMPT]: [
    "aiOutputId",
    "action",
    "outcome",
    "safeForReliance",
  ],
}

export function buildResearchTelemetry<E extends ResearchAnalyticsEvent>(
  event: E,
  payload: ResearchEventPayloads[E],
): Record<string, string | number | boolean> {
  const result: Record<string, string | number | boolean> = {}
  const source = payload as Record<string, unknown>
  for (const key of ALLOWED_PROPERTIES[event]) {
    const value = source[key]
    if (typeof value === "string" && value.trim()) result[key] = value
    if (typeof value === "boolean") result[key] = value
    if (typeof value === "number" && Number.isFinite(value)) {
      result[key] = Math.max(0, Math.round(value))
    }
  }
  return result
}

export function trackResearchEvent<E extends ResearchAnalyticsEvent>(
  event: E,
  payload: ResearchEventPayloads[E],
): void {
  trackEvent(event, buildResearchTelemetry(event, payload))
}
