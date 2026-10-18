export const LEGAL_RESEARCH_LANDING_SESSION_KEY = "legal_research_landing_session"

export interface LegalResearchLandingSession {
  query: string
  countryCode: "IN" | "US"
  anonymousSessionId: string
}

export function saveLegalResearchLandingSession(
  state: LegalResearchLandingSession,
): void {
  if (typeof window === "undefined") return
  sessionStorage.setItem(LEGAL_RESEARCH_LANDING_SESSION_KEY, JSON.stringify(state))
}

export function loadLegalResearchLandingSession(): LegalResearchLandingSession | null {
  if (typeof window === "undefined") return null
  const raw = sessionStorage.getItem(LEGAL_RESEARCH_LANDING_SESSION_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as LegalResearchLandingSession
  } catch {
    return null
  }
}

export function clearLegalResearchLandingSession(): void {
  if (typeof window === "undefined") return
  sessionStorage.removeItem(LEGAL_RESEARCH_LANDING_SESSION_KEY)
}
