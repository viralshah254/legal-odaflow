/** Plain-language copy for connection failures — never mention ports, env vars, or infra. */
export const USER_CONNECTION_ERROR =
  "We couldn't connect right now. Check your internet and try again in a moment."

export const COMPLIANCE_POLICY_UNAVAILABLE_MESSAGE =
  "Legal research is not yet available for this country. Try India, United States, United Kingdom, France, or EU."

export const RESEARCH_JOB_CALM_FALLBACK =
  "Here is a first-pass note from the question and contract text. A fuller memo was not ready in time."

export function isResearchStallOrTimeoutMessage(message: string): boolean {
  return /stalled|allowable limit|Missing lock|research drafting exceeded|mode deadline|first-pass note/i.test(
    message,
  )
}

export function sanitizeResearchJobError(
  message: string,
  fallback: string = RESEARCH_JOB_CALM_FALLBACK,
): string {
  const normalized = message.trim()
  if (!normalized) return fallback
  if (isResearchStallOrTimeoutMessage(normalized)) return RESEARCH_JOB_CALM_FALLBACK
  if (/timed out|timeout|deadline|exceeded/i.test(normalized)) return RESEARCH_JOB_CALM_FALLBACK
  return toUserFacingErrorMessage(normalized, fallback)
}

const COMPLIANCE_POLICY_NOT_FOUND_PATTERN =
  /compliance policy not found for\s+([A-Z]{2})/i

const DEVELOPER_ERROR_PATTERN =
  /port 4000|api_url|backend is running|start the backend|deploy the backend|could not reach the api backend|npm run start:dev|nestjs|vercel to your api|check api_url|local backend/i

/** True when a message is meant for engineers, not end users. */
export function isDeveloperFacingErrorMessage(message: string): boolean {
  const normalized = message.trim()
  if (!normalized) return false
  return DEVELOPER_ERROR_PATTERN.test(normalized)
}

/** Strip infra jargon; keep intentional product copy (e.g. OAuth-only accounts). */
export function toUserFacingErrorMessage(
  message: string,
  fallback: string = USER_CONNECTION_ERROR,
): string {
  const normalized = message.trim()
  if (!normalized) return fallback

  const complianceMatch = normalized.match(COMPLIANCE_POLICY_NOT_FOUND_PATTERN)
  if (complianceMatch) {
    return COMPLIANCE_POLICY_UNAVAILABLE_MESSAGE
  }

  if (isResearchStallOrTimeoutMessage(normalized)) {
    return RESEARCH_JOB_CALM_FALLBACK
  }

  if (isDeveloperFacingErrorMessage(normalized)) return fallback
  if (/^could not reach the server\./i.test(normalized)) return fallback
  if (/^network error\./i.test(normalized)) return fallback
  return normalized
}

/** Parse NestJS `{ error: { message } }` and legacy `{ message }` API error bodies. */
export function extractApiErrorMessage(body: unknown, fallback: string): string {
  if (!body || typeof body !== "object") return fallback
  const record = body as Record<string, unknown>

  const nested = record.error
  if (nested && typeof nested === "object") {
    const nestedMessage = (nested as Record<string, unknown>).message
    if (typeof nestedMessage === "string" && nestedMessage.trim()) {
      return nestedMessage.trim()
    }
    if (Array.isArray(nestedMessage)) {
      const parts = nestedMessage.filter((part): part is string => typeof part === "string")
      if (parts.length) return parts.join(". ")
    }
  }

  const msg = record.message
  if (typeof msg === "string" && msg.trim()) return msg.trim()
  if (Array.isArray(msg)) {
    const parts = msg.filter((part): part is string => typeof part === "string")
    if (parts.length) return parts.join(". ")
  }

  return fallback
}
