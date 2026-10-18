const storageKey = (userId: string) => `intro-offer-last-shown-${userId}`

function todayLocalDate(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function wasIntroOfferShownToday(userId: string): boolean {
  if (typeof window === "undefined") return true
  try {
    return localStorage.getItem(storageKey(userId)) === todayLocalDate()
  } catch {
    return true
  }
}

export function markIntroOfferShownToday(userId: string): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(storageKey(userId), todayLocalDate())
  } catch {
    // localStorage unavailable
  }
}
