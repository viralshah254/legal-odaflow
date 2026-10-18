export type SignUpEmailGuardAction =
  | "allow"
  | "redirect_sign_in"
  | "social_only"
  | "lookup_unavailable"

export interface SignUpEmailLookupResult {
  exists: boolean
  hasPassword: boolean
  hasFirebaseAccount: boolean
}

export function resolveSignUpEmailGuard(input: {
  lookup?: SignUpEmailLookupResult | null
  lookupFailed?: boolean
}): SignUpEmailGuardAction {
  const { lookup, lookupFailed } = input

  if (lookupFailed || !lookup) {
    return lookupFailed ? "lookup_unavailable" : "allow"
  }

  if (lookup.exists && lookup.hasPassword) {
    return "redirect_sign_in"
  }

  if (lookup.exists && !lookup.hasPassword) {
    if (lookup.hasFirebaseAccount) {
      return "redirect_sign_in"
    }
    return "social_only"
  }

  return "allow"
}

export function buildSignInUrl(input: {
  email: string
  redirectTo?: string | null
  refCode?: string | null
}): string {
  const params = new URLSearchParams()
  if (input.email) params.set("email", input.email)
  if (input.redirectTo) params.set("redirect", input.redirectTo)
  if (input.refCode) params.set("ref", input.refCode)
  const query = params.toString()
  return query ? `/auth/?${query}` : "/auth/"
}
