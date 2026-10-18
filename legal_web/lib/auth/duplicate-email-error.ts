import { FirebaseError } from "@firebase/app"
import { USER_CONNECTION_ERROR } from "@/lib/errors/user-facing-messages"

export function isDuplicateEmailError(error: unknown): boolean {
  if (error instanceof FirebaseError && error.code === "auth/email-already-in-use") {
    return true
  }

  const message =
    error instanceof Error
      ? error.message
      : error && typeof error === "object" && "message" in error
        ? String((error as { message?: unknown }).message ?? "")
        : String(error ?? "")

  return /already registered|already exists|email-already-in-use/i.test(message)
}

export function isConnectionError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : error && typeof error === "object" && "message" in error
        ? String((error as { message?: unknown }).message ?? "")
        : String(error ?? "")

  return (
    message === USER_CONNECTION_ERROR ||
    /couldn't connect|network error|failed to fetch|check your internet/i.test(message)
  )
}
