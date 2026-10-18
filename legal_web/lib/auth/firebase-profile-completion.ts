import { ApiClientError } from "@/lib/api/client"

export const PROFILE_COMPLETION_REQUIRED = "PROFILE_COMPLETION_REQUIRED"

export interface ProfileCompletionPayload {
  email: string
  name: string | null
}

export class FirebaseProfileCompletionRequiredError extends Error {
  readonly code = PROFILE_COMPLETION_REQUIRED
  readonly profile: ProfileCompletionPayload

  constructor(profile: ProfileCompletionPayload) {
    super("Profile completion required")
    this.name = "FirebaseProfileCompletionRequiredError"
    this.profile = profile
  }
}

export function readProfileFromBody(body: unknown): ProfileCompletionPayload | null {
  if (!body || typeof body !== "object") return null

  const record = body as Record<string, unknown>
  const candidates: Record<string, unknown>[] = [record]

  if (
    record.message &&
    typeof record.message === "object" &&
    !Array.isArray(record.message)
  ) {
    candidates.push(record.message as Record<string, unknown>)
  }

  if (record.error && typeof record.error === "object") {
    const error = record.error as Record<string, unknown>
    candidates.push(error)
    if (
      error.details &&
      typeof error.details === "object" &&
      !Array.isArray(error.details)
    ) {
      candidates.push(error.details as Record<string, unknown>)
    }
  }

  for (const candidate of candidates) {
    if (candidate.code !== PROFILE_COMPLETION_REQUIRED) continue

    const email = typeof candidate.email === "string" ? candidate.email : null
    if (!email) continue

    const name =
      typeof candidate.name === "string"
        ? candidate.name
        : candidate.name === null
          ? null
          : null

    return { email, name }
  }

  return null
}

export function parseProfileCompletionError(
  error: unknown,
): ProfileCompletionPayload | null {
  if (error instanceof FirebaseProfileCompletionRequiredError) {
    return error.profile
  }

  if (error instanceof ApiClientError && error.statusCode === 422) {
    return readProfileFromBody(error.body)
  }

  if (error instanceof Error) {
    try {
      return readProfileFromBody(JSON.parse(error.message))
    } catch {
      // not JSON
    }
  }

  return null
}

export function isProfileCompletionRequired(
  error: unknown,
): error is FirebaseProfileCompletionRequiredError {
  return parseProfileCompletionError(error) !== null
}
