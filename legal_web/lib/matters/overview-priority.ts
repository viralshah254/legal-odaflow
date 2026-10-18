export type MatterPriorityKind = "ask-ai" | "review-risk"

export interface MatterPrioritySelection {
  primary: MatterPriorityKind
  suggestions: MatterPriorityKind[]
  normalizedRiskScore: number
  riskLevel?: "high" | "critical"
}

export function normalizeMatterRiskScore(score: number | null | undefined): number {
  if (!Number.isFinite(score)) return 0
  return score! <= 1 ? score! * 100 : score!
}

export function selectMatterOverviewPriority(
  riskScore: number | null | undefined,
): MatterPrioritySelection {
  const normalizedRiskScore = normalizeMatterRiskScore(riskScore)
  if (normalizedRiskScore >= 60) {
    return {
      primary: "review-risk",
      suggestions: ["ask-ai"],
      normalizedRiskScore,
      riskLevel: normalizedRiskScore >= 80 ? "critical" : "high",
    }
  }

  return {
    primary: "ask-ai",
    suggestions: [],
    normalizedRiskScore,
  }
}

export function shouldRenderPriorityDisclosure(
  suggestions: readonly unknown[] | null | undefined,
): boolean {
  return Boolean(suggestions?.length)
}
