import { apiFetch, buildAuthHeaders, ApiClientError } from "./client"
import {
  CLOUDFLARE_CHALLENGE_ERROR,
  looksLikeCloudflareChallenge,
  throwIfCloudflareChallengeResponse,
} from "./cloudflare-challenge"
import type {
  ConsumerCase,
  CreateConsumerCaseRequest,
  IssueCheckerClassifyRequest,
  IssueCheckerClassifyResponse,
  IssueCheckerPreviewRequest,
  IssueCheckerPreviewResponse,
  IssueCheckerTeaserRequest,
  IssueCheckerTeaserResponse,
  LegalResearchTeaserRequest,
  LegalResearchTeaserResponse,
  UpdateConsumerCaseRequest,
} from "./types"

export async function listCases(): Promise<ConsumerCase[]> {
  return apiFetch<ConsumerCase[]>("/consumers/cases")
}

export async function getCase(caseId: string): Promise<ConsumerCase> {
  return apiFetch<ConsumerCase>(`/consumers/cases/${caseId}`)
}

export async function createCase(
  data: CreateConsumerCaseRequest,
): Promise<ConsumerCase> {
  return apiFetch<ConsumerCase>("/consumers/cases", {
    method: "POST",
    body: data,
  })
}

export async function updateCase(
  caseId: string,
  data: UpdateConsumerCaseRequest,
): Promise<ConsumerCase> {
  return apiFetch<ConsumerCase>(`/consumers/cases/${caseId}`, {
    method: "PATCH",
    body: data,
  })
}

export async function deleteCase(
  caseId: string,
): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/consumers/cases/${caseId}`, {
    method: "DELETE",
  })
}

export async function classifyIssueChecker(
  data: IssueCheckerClassifyRequest,
): Promise<IssueCheckerClassifyResponse> {
  return apiFetch<IssueCheckerClassifyResponse>(
    "/consumers/issue-checker/classify",
    {
      method: "POST",
      body: data,
      auth: false,
    },
  )
}

export async function teaserIssueChecker(
  data: IssueCheckerTeaserRequest,
): Promise<IssueCheckerTeaserResponse> {
  return apiFetch<IssueCheckerTeaserResponse>(
    "/consumers/issue-checker/teaser",
    {
      method: "POST",
      body: data,
      auth: false,
    },
  )
}

export async function teaserLegalResearch(
  data: LegalResearchTeaserRequest,
): Promise<LegalResearchTeaserResponse> {
  return apiFetch<LegalResearchTeaserResponse>(
    "/consumers/legal-research/teaser",
    {
      method: "POST",
      body: data,
      auth: false,
    },
  )
}

export async function previewIssueChecker(
  data: IssueCheckerPreviewRequest,
  tenantId?: string,
): Promise<IssueCheckerPreviewResponse> {
  // In production on Vercel the Next.js API proxy has a hard 300s serverless
  // function limit. Complex intake previews (bail, writ, commercial) can exceed
  // this because they run MI classification + authority retrieval + premium LLM.
  // When NEXT_PUBLIC_WS_URL is set (production), call the backend directly from
  // the browser — same pattern as generateIndiaDraft — so the request bypasses
  // the Vercel proxy entirely and only nginx (600s) limits it.
  const directBackendOrigin =
    typeof window !== "undefined"
      ? (process.env.NEXT_PUBLIC_WS_URL ?? "").replace(/\/$/, "")
      : ""

  if (directBackendOrigin && !/localhost|127\.0\.0\.1/.test(directBackendOrigin)) {
    const headers = await buildAuthHeaders(true, tenantId)
    headers.set("Content-Type", "application/json")

    const response = await fetch(
      `${directBackendOrigin}/api/v1/consumers/issue-checker/preview/`,
      { method: "POST", headers, body: JSON.stringify(data) },
    ).catch(() => {
      throw new Error("Network error — could not reach the API. Check your connection and try again.")
    })

    const text = await response.text().catch(() => "")
    throwIfCloudflareChallengeResponse(response, text)

    if (!response.ok) {
      let message = text
      try { message = (JSON.parse(text) as { message?: string }).message ?? text } catch { /* noop */ }
      throw new ApiClientError(message || response.statusText, response.status)
    }

    return parseIssueCheckerPreviewBody(text)
  }

  const result = await apiFetch<IssueCheckerPreviewResponse | string>(
    "/consumers/issue-checker/preview",
    {
      method: "POST",
      body: data,
    },
  )
  return parseIssueCheckerPreviewBody(result)
}

function parseIssueCheckerPreviewBody(
  result: IssueCheckerPreviewResponse | string,
): IssueCheckerPreviewResponse {
  if (typeof result === "string") {
    if (looksLikeCloudflareChallenge(result)) {
      throw new ApiClientError(CLOUDFLARE_CHALLENGE_ERROR, 403, { challenge: true })
    }
    try {
      return JSON.parse(result) as IssueCheckerPreviewResponse
    } catch {
      throw new ApiClientError(result || "Request failed", 502)
    }
  }
  return result
}

export interface GenerateFullReportResponse {
  report: import("./types").ConsumerLegalReport
  sectionCount: number
  disclaimer: string
}

export async function generateFullReport(
  caseId: string,
): Promise<GenerateFullReportResponse & { creditsCharged?: number; creditsRemaining?: number }> {
  return apiFetch(
    `/consumer-reports/cases/${caseId}/full`,
    { method: "POST" },
  )
}

export interface GenerateReportSectionResponse {
  sectionTitle: string
  content: string
  creditsCharged: number
  creditsRemaining: number
  report: import("./types").ConsumerLegalReport
}

export async function generateReportSection(
  caseId: string,
  sectionTitle: string,
): Promise<GenerateReportSectionResponse> {
  return apiFetch<GenerateReportSectionResponse>(
    `/consumer-reports/cases/${caseId}/sections`,
    {
      method: "POST",
      body: { sectionTitle },
    },
  )
}

export interface ReportSectionCostsResponse {
  costs: Record<string, number>
  bundleCredits: number
}

export async function getReportSectionCosts(
  caseId: string,
): Promise<ReportSectionCostsResponse> {
  return apiFetch<ReportSectionCostsResponse>(
    `/consumer-reports/cases/${caseId}/sections/costs`,
  )
}

export interface ConsumerCreditsResponse {
  balance: number
  profileBalance: number
  countryCode: string
  packs: Array<{
    packId: string
    credits: number
    label: string
    description: string
    countryCode: string
    currency: string
    amount: number
  }>
  ledger: Array<{
    id: string
    eventType: string
    taskType: string
    credits: number
    createdAt: string
  }>
}

export interface CreditTopupCheckoutRequest {
  countryCode: string
  packId?: string
  /** Custom USD amount for ad-hoc top-up (min $5). When set, packId is not required. */
  customAmountUsd?: number
  /** Page path to return to after Stripe completes (e.g. /app/us-drafting/draft?kind=...) */
  returnPath?: string
}

export interface CreditTopupCheckoutResponse {
  paymentId: string
  packId: string
  credits: number
  amount: number
  currency: string
  checkoutUrl: string
  clientSecret?: string
  provider: string
  status: string
}

export async function getConsumerCredits(): Promise<ConsumerCreditsResponse> {
  return apiFetch<ConsumerCreditsResponse>("/consumers/me/credits")
}

export async function startCreditTopupCheckout(
  data: CreditTopupCheckoutRequest,
): Promise<CreditTopupCheckoutResponse> {
  return apiFetch<CreditTopupCheckoutResponse>("/consumers/credits/topup/checkout", {
    method: "POST",
    body: data,
  })
}

export interface PlanQuestionsRequest {
  countryCode: string
  facts: string
  mode?: string
  issueType?: string
  /** Parties hint from classify — improves role inference. */
  parties?: string
  captchaToken?: string
  deviceFingerprint?: string
}

export interface PlanQuestion {
  id: string
  text: string
  required: boolean
  type: "single" | "multi" | "text"
  options: string[]
  allowAllOfAbove?: boolean
}

export type ExtractedFieldValue = string | string[] | null

export interface PlanQuestionsResponse {
  extractedFields?: Record<string, ExtractedFieldValue>
  questions: PlanQuestion[]
}

export async function getPlanQuestions(
  data: PlanQuestionsRequest,
): Promise<PlanQuestionsResponse> {
  return apiFetch<PlanQuestionsResponse>("/consumers/issue-checker/plan-questions", {
    method: "POST",
    body: data,
    auth: false,
  })
}

export interface OutcomeOptionsRequest {
  facts: string
  countryCode: string
  practiceArea?: string
  captchaToken?: string
  deviceFingerprint?: string
}

export interface OutcomeOptionsResponse {
  options: string[]
}

export async function getOutcomeOptions(
  data: OutcomeOptionsRequest,
): Promise<OutcomeOptionsResponse> {
  return apiFetch<OutcomeOptionsResponse>("/consumers/issue-checker/outcome-options", {
    method: "POST",
    body: data,
    auth: false,
  })
}
