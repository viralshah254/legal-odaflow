export interface Subscription {
  id: string
  plan: "STARTER" | "PROFESSIONAL" | "ENTERPRISE"
  billingCycle: "monthly" | "annual"
  userCount: number
  pricePerUser: number
  currency: string
  currencySymbol: string
  startDate: Date
  nextBillingDate: Date
  status: "trial" | "active" | "cancelled"
  trialEndDate?: Date
  createdAt: Date
  updatedAt: Date
}

let currentSubscription: Subscription | null = null

// Load from localStorage
if (typeof window !== "undefined") {
  const saved = localStorage.getItem("subscription")
  if (saved) {
    try {
      const parsed = JSON.parse(saved)
      currentSubscription = {
        ...parsed,
        startDate: new Date(parsed.startDate),
        nextBillingDate: new Date(parsed.nextBillingDate),
        trialEndDate: parsed.trialEndDate ? new Date(parsed.trialEndDate) : undefined,
        createdAt: new Date(parsed.createdAt),
        updatedAt: new Date(parsed.updatedAt),
      }
    } catch (e) {
      // Invalid JSON, use null
    }
  }
}

export function getCurrentSubscription(): Subscription | null {
  return currentSubscription ? { ...currentSubscription } : null
}

export function createSubscription(
  plan: "STARTER" | "PROFESSIONAL" | "ENTERPRISE",
  billingCycle: "monthly" | "annual",
  userCount: number,
  pricePerUser: number,
  currency: string,
  currencySymbol: string
): Subscription {
  const now = new Date()
  const trialEndDate = new Date(now)
  trialEndDate.setDate(trialEndDate.getDate() + 30) // 30-day trial

  let nextBillingDate: Date
  if (billingCycle === "monthly") {
    nextBillingDate = new Date(trialEndDate)
  } else {
    nextBillingDate = new Date(trialEndDate)
    nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1)
  }

  currentSubscription = {
    id: `sub-${Date.now()}`,
    plan,
    billingCycle,
    userCount,
    pricePerUser,
    currency,
    currencySymbol,
    startDate: now,
    nextBillingDate,
    status: "trial",
    trialEndDate,
    createdAt: now,
    updatedAt: now,
  }

  if (typeof window !== "undefined") {
    localStorage.setItem("subscription", JSON.stringify(currentSubscription))
  }

  return { ...currentSubscription }
}

export function addUsersToSubscription(additionalUsers: number): { proRataAmount: number; newUserCount: number } {
  if (!currentSubscription) {
    throw new Error("No active subscription")
  }

  const now = new Date()
  const newUserCount = currentSubscription.userCount + additionalUsers

  // Calculate pro-rata amount
  let proRataAmount = 0

  if (currentSubscription.billingCycle === "monthly") {
    // Calculate remaining days in current billing period
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const currentDay = now.getDate()
    const remainingDays = daysInMonth - currentDay + 1
    const dailyRate = (currentSubscription.pricePerUser * additionalUsers) / daysInMonth
    proRataAmount = dailyRate * remainingDays
  } else {
    // Annual: calculate remaining days in the year
    const yearStart = new Date(now.getFullYear(), 0, 1)
    const yearEnd = new Date(now.getFullYear() + 1, 0, 1)
    const totalDays = Math.floor((yearEnd.getTime() - yearStart.getTime()) / (24 * 60 * 60 * 1000))
    const daysElapsed = Math.floor((now.getTime() - yearStart.getTime()) / (24 * 60 * 60 * 1000))
    const remainingDays = totalDays - daysElapsed
    const dailyRate = (currentSubscription.pricePerUser * additionalUsers * 12) / totalDays
    proRataAmount = dailyRate * remainingDays
  }

  // Update subscription
  currentSubscription.userCount = newUserCount
  currentSubscription.updatedAt = new Date()

  if (typeof window !== "undefined") {
    localStorage.setItem("subscription", JSON.stringify(currentSubscription))
  }

  return {
    proRataAmount: Math.round(proRataAmount * 100) / 100, // Round to 2 decimal places
    newUserCount,
  }
}

export function updateSubscriptionUserCount(userCount: number): void {
  if (!currentSubscription) {
    throw new Error("No active subscription")
  }

  currentSubscription.userCount = userCount
  currentSubscription.updatedAt = new Date()

  if (typeof window !== "undefined") {
    localStorage.setItem("subscription", JSON.stringify(currentSubscription))
  }
}

export function cancelSubscription(): void {
  if (currentSubscription) {
    currentSubscription.status = "cancelled"
    currentSubscription.updatedAt = new Date()
    if (typeof window !== "undefined") {
      localStorage.setItem("subscription", JSON.stringify(currentSubscription))
    }
  }
}

export function updateSubscriptionPlan(newPlan: "STARTER" | "PROFESSIONAL" | "ENTERPRISE", newPricePerUser: number): Subscription {
  if (!currentSubscription) {
    throw new Error("No active subscription")
  }

  currentSubscription.plan = newPlan
  currentSubscription.pricePerUser = newPricePerUser
  currentSubscription.updatedAt = new Date()

  if (typeof window !== "undefined") {
    localStorage.setItem("subscription", JSON.stringify(currentSubscription))
  }

  return { ...currentSubscription }
}

