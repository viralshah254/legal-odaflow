export type EmailAuthPath = "sign_up" | "enter_password" | "social_only"

export interface EmailLookupResult {
  exists: boolean
  hasPassword: boolean
  hasFirebaseAccount: boolean
}

export function resolveEmailAuthPath(input: {
  signInMethods: string[]
  lookup?: EmailLookupResult | null
  lookupFailed?: boolean
}): EmailAuthPath {
  const { signInMethods, lookup, lookupFailed } = input
  const hasPasswordMethod = signInMethods.includes("password")
  const hasSocialMethod = signInMethods.some((method) => method !== "password")

  if (hasSocialMethod && !hasPasswordMethod) {
    // Backend password accounts win over Firebase provider hints — a Google/Apple
    // link in Firebase must not block email/password users created in our DB.
    if (lookup?.exists && lookup.hasPassword) {
      return "enter_password"
    }
    return "social_only"
  }

  if (lookup?.exists && lookup.hasPassword) {
    return "enter_password"
  }

  // New to Umbrella DB — backend is source of truth for sign-up vs sign-in.
  if (lookup && !lookup.exists) {
    // Firebase may already have this email (abandoned signup) — sign in to link.
    if (hasPasswordMethod) {
      return "enter_password"
    }
    return "sign_up"
  }

  if (lookup?.exists && !lookup.hasPassword) {
    // Backend is source of truth: no password hash means OAuth / social sign-in.
    // Do not infer password sign-in from an empty Firebase methods list — enumeration
    // protection often hides providers and would misroute Google/Apple accounts.
    if (hasPasswordMethod) {
      return "enter_password"
    }
    return "social_only"
  }

  if (hasPasswordMethod) {
    return "enter_password"
  }

  if (lookupFailed || !lookup) {
    return "sign_up"
  }

  return "sign_up"
}
