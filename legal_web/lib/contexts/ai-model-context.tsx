"use client"

import { createContext, useContext } from "react"

export type AiModelMode = "AUTO" | "PREMIUM"
export interface AiPremiumModel {
  modelId: string
  label: string
  costTier?: string
  estimatedCreditsTypical?: number
}
export interface AiWalletMeta {
  creditsRemaining: number
  autoPercentUsed: number
  premiumPercentUsed: number
  autoModelName?: string
}

// Routing is a server policy. Legacy saved preferences cannot downgrade legal work.
const context = createContext({
  mode: "PREMIUM" as AiModelMode,
  modelId: "gpt-5.6-sol",
  setAiModel: (_mode: AiModelMode, _modelId: string) => {},
  isSaving: false,
  availableModels: [] as AiPremiumModel[],
  walletMeta: null as AiWalletMeta | null,
})
export function AiModelProvider({ children }: { children: React.ReactNode }) {
  return <context.Provider value={useContext(context)}>{children}</context.Provider>
}
export function useAiModel() { return useContext(context) }
