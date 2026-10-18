import { describe, expect, it } from "vitest"
import { FirebaseError } from "@firebase/app"
import {
  isFirebaseCredentialMismatch,
  getFirebaseAuthErrorMessage,
} from "./firebase-errors"

describe("isFirebaseCredentialMismatch", () => {
  it("treats invalid-login-credentials as backend fallback", () => {
    const error = {
      name: "FirebaseError",
      code: "auth/invalid-login-credentials",
      message: "Firebase: Error (auth/invalid-login-credentials).",
    }
    expect(isFirebaseCredentialMismatch(error)).toBe(true)
  })
})

describe("getFirebaseAuthErrorMessage", () => {
  const t = (key: string) => key

  it("maps backend unreachable to a friendly connection message", () => {
    const devMessage =
      "Could not reach the server. Check that the backend is running on port 4000 and try again."
    expect(getFirebaseAuthErrorMessage(new Error(devMessage), t)).toBe("connection")
  })

  it("returns oauth-only backend message verbatim", () => {
    const message =
      "This account uses Google or Apple sign-in. Use those options instead of a password."
    expect(getFirebaseAuthErrorMessage(new Error(message), t)).toBe(message)
  })

  it("maps missing-project-id to a setup hint", () => {
    const error = new FirebaseError(
      "auth/missing-project-id",
      "Firebase: Error (auth/missing-project-id).",
    )
    expect(getFirebaseAuthErrorMessage(error, t)).toBe("firebaseMissingProjectId")
  })
})
