export interface IntroOfferCountdown {
  days: number
  hours: number
  minutes: number
  expired: boolean
}

/** Live countdown from ISO expiry — floor each unit so the timer always counts down. */
export function computeIntroOfferCountdown(
  expiresAt: string | Date,
  nowMs = Date.now(),
): IntroOfferCountdown {
  const expiryMs = new Date(expiresAt).getTime()
  if (!Number.isFinite(expiryMs)) {
    return { days: 0, hours: 0, minutes: 0, expired: true }
  }

  let remainingMs = Math.max(0, expiryMs - nowMs)
  const days = Math.floor(remainingMs / 86_400_000)
  remainingMs %= 86_400_000
  const hours = Math.floor(remainingMs / 3_600_000)
  remainingMs %= 3_600_000
  const minutes = Math.floor(remainingMs / 60_000)

  return {
    days,
    hours,
    minutes,
    expired: expiryMs <= nowMs,
  }
}
