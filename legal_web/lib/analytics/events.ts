const DISTINCT_ID_KEY = "legal_analytics_distinct_id"

function getPostHogHost(): string {
  return (
    process.env.NEXT_PUBLIC_POSTHOG_HOST?.replace(/\/$/, "") ?? "https://app.posthog.com"
  )
}

export function getDistinctId(): string {
  if (typeof window === "undefined") return "server"
  const existing = localStorage.getItem(DISTINCT_ID_KEY)
  if (existing) return existing
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `anon-${Date.now()}`
  localStorage.setItem(DISTINCT_ID_KEY, id)
  return id
}

/** Lightweight PostHog capture stub — no-op when NEXT_PUBLIC_POSTHOG_KEY is unset. */
export function trackEvent(
  event: string,
  properties?: Record<string, unknown>,
): void {
  if (typeof window === "undefined") return

  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim()
  if (!apiKey) return

  void fetch(`${getPostHogHost()}/capture/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      event,
      properties: {
        ...properties,
        $lib: "legal_web",
      },
      distinct_id: getDistinctId(),
    }),
    keepalive: true,
  }).catch(() => {
    // Analytics must never break UX
  })
}

export const AnalyticsEvents = {
  LANDING_PAGE_VIEWED: "landing_page_viewed",
  LANDING_CTA_CLICKED: "landing_cta_clicked",
  ISSUE_CHECKER_STARTED: "issue_checker_started",
  ISSUE_CHECKER_COMPLETED: "issue_checker_completed",
  CONSUMER_REPORT_VIEWED: "consumer_report_viewed",
  LAWYER_REVIEW_REQUESTED: "lawyer_review_requested",
  SUBSCRIPTION_CHECKOUT_STARTED: "subscription_checkout_started",
  CHECKOUT_COMPLETED: "checkout_completed",
  CHECKOUT_ABANDONED: "checkout_abandoned",
  LEGAL_GUIDE_VIEWED: "legal_guide_viewed",
  MATTER_CREATED: "matter_created",
  OUTCOME_ANALYSIS_GENERATED: "outcome_analysis_generated",
  COURT_CASE_LINKED: "court_case_linked",
  RESEARCH_REVISION_COMPLETED: "research_revision_completed",
  RESEARCH_QUESTION_ANSWERED: "research_question_answered",
  RESEARCH_CITATION_RESOLVED: "research_citation_resolved",
  RESEARCH_CITATION_REJECTED: "research_citation_rejected",
  RESEARCH_LAWYER_DECISION_TIME: "research_lawyer_decision_time",
  RESEARCH_MATTER_CLIENT_FILED: "research_matter_client_filed",
  RESEARCH_DOCUMENT_FILED: "research_document_filed",
  RESEARCH_UNSAFE_EXPORT_ATTEMPT: "research_unsafe_export_attempt",
} as const
