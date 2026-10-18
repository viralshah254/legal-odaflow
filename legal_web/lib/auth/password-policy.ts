import { ZxcvbnFactory } from "@zxcvbn-ts/core"
import * as zxcvbnCommon from "@zxcvbn-ts/language-common"
import * as zxcvbnEn from "@zxcvbn-ts/language-en"

export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_MAX_LENGTH = 128

let zxcvbnClient: ZxcvbnFactory | null = null

function ensureZxcvbn(): ZxcvbnFactory {
  if (zxcvbnClient) return zxcvbnClient
  zxcvbnClient = new ZxcvbnFactory({
    dictionary: {
      ...zxcvbnCommon.dictionary,
      ...zxcvbnEn.dictionary,
    },
    graphs: zxcvbnCommon.adjacencyGraphs,
    translations: zxcvbnEn.translations,
  })
  return zxcvbnClient
}

export interface PasswordPolicyContext {
  email?: string
  name?: string
  firmName?: string
  phone?: string
}

export interface PasswordPolicyResult {
  valid: boolean
  score: number
  label: PasswordStrengthLabel
  errors: string[]
  feedback: string[]
}

export type PasswordStrengthLabel =
  | "veryWeak"
  | "weak"
  | "fair"
  | "strong"
  | "veryStrong"

export function passwordHasNumber(password: string): boolean {
  return /\d/.test(password)
}

export function passwordStrengthLabel(score: number): PasswordStrengthLabel {
  switch (score) {
    case 0:
      return "veryWeak"
    case 1:
      return "weak"
    case 2:
      return "fair"
    case 3:
      return "strong"
    default:
      return "veryStrong"
  }
}

export function validatePasswordPolicy(
  password: string,
  _context?: PasswordPolicyContext,
): PasswordPolicyResult {
  const errors: string[] = []
  const feedback: string[] = []

  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.push("tooShort")
    feedback.push(`Use at least ${PASSWORD_MIN_LENGTH} characters.`)
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    errors.push("tooLong")
    feedback.push("Use at most 128 characters.")
  }
  if (!passwordHasNumber(password)) {
    errors.push("missingNumber")
    feedback.push("Include at least one number.")
  }

  const analysis = ensureZxcvbn().check(password, [])
  const score = analysis.score

  return {
    valid: errors.length === 0,
    score,
    label: passwordStrengthLabel(score),
    errors,
    feedback,
  }
}

export function firstPasswordErrorMessage(
  result: PasswordPolicyResult,
  t: (key: string) => string,
): string {
  const keyMap: Record<string, string> = {
    tooShort: "passwordTooShort",
    tooLong: "passwordTooLong",
    missingNumber: "passwordMissingNumber",
  }
  const key = result.errors[0]
  if (key && keyMap[key]) return t(keyMap[key])
  return result.feedback[0] ?? t("passwordTooShort")
}
