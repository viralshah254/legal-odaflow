import { FirebaseError } from "@firebase/app"
import { toUserFacingErrorMessage } from "@/lib/errors/user-facing-messages"

function getFirebaseErrorCode(error: unknown): string | null {
  if (error instanceof FirebaseError) return error.code
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
  ) {
    return (error as { code: string }).code
  }
  return null
}

/** Firebase rejected credentials — caller may fall back to backend /auth/login. */
export function isFirebaseCredentialMismatch(error: unknown): boolean {
  const code = getFirebaseErrorCode(error)
  if (!code) return false
  return (
    code === "auth/invalid-credential" ||
    code === "auth/invalid-login-credentials" ||
    code === "auth/wrong-password" ||
    code === "auth/user-not-found"
  )
}

/** Firebase Auth is configured in env but Email/Password provider is not enabled server-side. */
export function isFirebaseAuthUnavailable(error: unknown): boolean {
  if (error instanceof FirebaseError) {
    return (
      error.code === "auth/configuration-not-found" ||
      error.code === "auth/operation-not-allowed"
    )
  }

  if (error && typeof error === "object" && "message" in error) {
    const message = String((error as { message?: unknown }).message ?? "")
    return (
      message.includes("CONFIGURATION_NOT_FOUND") ||
      message.includes("OPERATION_NOT_ALLOWED")
    )
  }

  return false
}

type ErrorTranslator = (key: string) => string

function isBackendUnreachableMessage(message: string): boolean {
  return /network|failed to fetch|could not reach|check your connection|api_url configuration/i.test(
    message,
  )
}

function isOAuthOnlyAccountMessage(message: string): boolean {
  return /google or apple sign-in/i.test(message)
}

export function getFirebaseAuthErrorMessage(error: unknown, t: ErrorTranslator): string {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case "auth/email-already-in-use":
        return t("emailAlreadyInUse")
      case "auth/invalid-email":
        return t("invalidEmail")
      case "auth/weak-password":
        return t("weakPassword")
      case "auth/wrong-password":
      case "auth/invalid-credential":
        return t("invalidCredentials")
      case "auth/user-not-found":
        return t("userNotFound")
      case "auth/too-many-requests":
        return t("tooManyRequests")
      case "auth/configuration-not-found":
      case "auth/operation-not-allowed":
        return t("firebaseEmailSignInDisabled")
      case "auth/missing-project-id":
        return t("firebaseMissingProjectId")
      case "auth/popup-closed-by-user":
      case "auth/cancelled-popup-request":
        return t("socialSignInCancelled")
      case "auth/popup-blocked":
        return t("socialSignInPopupBlocked")
      default:
        return error.message || t("authenticationFailed")
    }
  }

  if (error instanceof Error && error.message) {
    if (error.message === "APPLE_SIGNIN_LOCALHOST_UNSUPPORTED") {
      return t("appleSignInLocalhostUnsupported")
    }
    if (isBackendUnreachableMessage(error.message)) {
      return toUserFacingErrorMessage(error.message, t("connection"))
    }
    if (isOAuthOnlyAccountMessage(error.message)) {
      return error.message
    }
    return toUserFacingErrorMessage(error.message, t("generic"))
  }

  return t("generic")
}
