export const INTRO_DISCOUNT_PERCENT = 40

export function applyIntroDiscount(amount: number, eligible: boolean): number {
  if (!eligible) return amount
  return amount * (1 - INTRO_DISCOUNT_PERCENT / 100)
}
