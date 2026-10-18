import { ApiClientError } from "@/lib/api/client"

const INSUFFICIENT_PATTERNS = [
  "insufficient credit",
  "insufficient ai credit",
  "no ai credits",
  "not enough credit",
  "credit balance",
  "top up",
  "top-up",
  "premium allowance",
  "buy more credits",
  "purchase more credits",
  "switch to auto",
  "used your ai credits",
  "used all your free daily",
  "free daily ai credits",
  "you're out of ai credits",
  "out of ai credits",
  "subscribe to continue",
  "daily reset",
  "wait for your daily",
  "wait until tomorrow",
]

export function isInsufficientCreditsMessage(message: string): boolean {
  const normalized = message.toLowerCase()
  return INSUFFICIENT_PATTERNS.some((pattern) => normalized.includes(pattern))
}

export function isInsufficientCreditsError(error: unknown): boolean {
  if (error instanceof ApiClientError) {
    if (error.statusCode === 403 && isInsufficientCreditsMessage(error.message)) {
      return true
    }
    return isInsufficientCreditsMessage(error.message)
  }
  if (error instanceof Error) {
    return isInsufficientCreditsMessage(error.message)
  }
  return false
}

export function getCreditErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    return error.message
  }
  if (error instanceof Error) {
    return error.message
  }
  return "An unexpected error occurred"
}

export interface InsufficientCreditsInfo {
  message: string
  suggestedAction: "buy_credits" | "upgrade_plan" | "contact_admin"
}

export function parseInsufficientCreditsError(
  error: unknown,
  context: "consumer" | "firm" = "consumer",
): InsufficientCreditsInfo | null {
  if (!isInsufficientCreditsError(error)) return null

  return {
    message: getCreditErrorMessage(error),
    suggestedAction: context === "consumer" ? "buy_credits" : "buy_credits",
  }
}
