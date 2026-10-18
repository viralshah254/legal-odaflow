import { ApiClientError } from "@/lib/api/client"
import { USER_CONNECTION_ERROR } from "@/lib/errors/user-facing-messages"

export const CLOUDFLARE_CHALLENGE_ERROR =
  "A security check interrupted the request. Retry after the check completes."

const CHALLENGE_BODY_RE =
  /cloudflare|cf-browser-verification|challenge-platform|just a moment|verifying you are human|cf-mitigated|attention required|enable javascript and cookies/i

export function looksLikeCloudflareChallenge(body: string): boolean {
  const sample = body.slice(0, 4000)
  if (!sample.trim()) return false
  if (CHALLENGE_BODY_RE.test(sample)) return true
  const looksHtml = /<!doctype html|<html[\s>]|<title>/i.test(sample)
  return looksHtml && /cdn-cgi|cf-chl|challenge/i.test(sample)
}

export function isCloudflareChallengeResponse(input: {
  status: number
  body?: string
  contentType?: string | null
  cfMitigated?: string | null
}): boolean {
  if (input.cfMitigated && input.cfMitigated !== "0") return true
  const contentType = input.contentType ?? ""
  const body = input.body ?? ""
  const htmlContent = /text\/html/i.test(contentType)
  if (input.status === 403 && (htmlContent || looksLikeCloudflareChallenge(body))) {
    return true
  }
  if (htmlContent && looksLikeCloudflareChallenge(body)) return true
  return looksLikeCloudflareChallenge(body)
}

export function isCloudflareChallengeError(err: unknown): boolean {
  if (err instanceof ApiClientError) {
    const body = err.body
    if (body && typeof body === "object" && (body as { challenge?: boolean }).challenge) {
      return true
    }
    return looksLikeCloudflareChallenge(err.message)
  }
  return err instanceof Error && looksLikeCloudflareChallenge(err.message)
}

/** Challenge, dropped fetch, or gateway cut — retry the firm intake save once. */
export function isRetryableIntakeSaveError(err: unknown): boolean {
  if (isCloudflareChallengeError(err)) return true
  if (err instanceof ApiClientError) {
    return err.statusCode === 502 || err.statusCode === 504
  }
  if (err instanceof Error) {
    return (
      /failed to fetch|network|CORS|hang up|ECONNRESET|ECONNREFUSED/i.test(err.message) ||
      err.message === USER_CONNECTION_ERROR
    )
  }
  return false
}

export function throwIfCloudflareChallengeResponse(
  response: Response,
  body: string,
): void {
  if (
    !isCloudflareChallengeResponse({
      status: response.status,
      body,
      contentType: response.headers.get("content-type"),
      cfMitigated: response.headers.get("cf-mitigated"),
    })
  ) {
    return
  }
  throw new ApiClientError(CLOUDFLARE_CHALLENGE_ERROR, response.status === 200 ? 403 : response.status, {
    challenge: true,
  })
}
