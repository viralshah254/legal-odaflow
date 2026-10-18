import type { KycDocument } from "@/lib/types/kyc"

export const CLIENT_TABS = ["overview", "kyc", "matters", "documents", "meetings"] as const
export type ClientTab = (typeof CLIENT_TABS)[number]

export function resolveClientTab(value: string | null | undefined): ClientTab {
  return CLIENT_TABS.includes(value as ClientTab) ? (value as ClientTab) : "overview"
}

export function buildClientTabHref(
  clientId: string,
  tab: ClientTab,
  currentQuery = "",
): string {
  const query = new URLSearchParams(currentQuery)
  if (tab === "overview") query.delete("tab")
  else query.set("tab", tab)
  const suffix = query.toString()
  return `/app/clients/${clientId}${suffix ? `?${suffix}` : ""}`
}

export function getKycCompletionPercent(documents: KycDocument[] = []): number {
  if (!documents.length) return 0
  return Math.round(
    (documents.filter((document) => document.status === "VERIFIED").length /
      documents.length) *
      100,
  )
}

export function riskFromScore(
  score: number | null | undefined,
): "Low" | "Medium" | "High" | "Critical" {
  if (!score || score < 35) return "Low"
  if (score >= 80) return "Critical"
  if (score >= 60) return "High"
  return "Medium"
}
