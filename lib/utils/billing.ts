/**
 * Calculate pro-rata amount for adding users to an existing subscription
 */
export function calculateProRataAmount(
  pricePerUser: number,
  additionalUsers: number,
  billingCycle: "monthly" | "annual",
  currentDate: Date = new Date()
): number {
  if (billingCycle === "monthly") {
    // Calculate remaining days in current month
    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate()
    const currentDay = currentDate.getDate()
    const remainingDays = daysInMonth - currentDay + 1
    const dailyRate = (pricePerUser * additionalUsers) / daysInMonth
    return Math.round(dailyRate * remainingDays * 100) / 100
  } else {
    // Annual: calculate remaining days in the year
    const yearStart = new Date(currentDate.getFullYear(), 0, 1)
    const yearEnd = new Date(currentDate.getFullYear() + 1, 0, 1)
    const totalDays = Math.floor((yearEnd.getTime() - yearStart.getTime()) / (24 * 60 * 60 * 1000))
    const daysElapsed = Math.floor((currentDate.getTime() - yearStart.getTime()) / (24 * 60 * 60 * 1000))
    const remainingDays = totalDays - daysElapsed
    const dailyRate = (pricePerUser * additionalUsers * 12) / totalDays
    return Math.round(dailyRate * remainingDays * 100) / 100
  }
}

/**
 * Calculate total monthly/annual cost based on user count
 */
export function calculateTotalCost(
  pricePerUser: number,
  userCount: number,
  billingCycle: "monthly" | "annual"
): number {
  if (billingCycle === "monthly") {
    return pricePerUser * userCount
  } else {
    // Annual with 20% discount
    return (pricePerUser * userCount * 12) * 0.8
  }
}

/**
 * Format billing period text
 */
export function formatBillingPeriod(billingCycle: "monthly" | "annual"): string {
  return billingCycle === "monthly" ? "month" : "year"
}




