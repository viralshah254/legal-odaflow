"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { getCreditWallet, updateAiPreferences } from "@/lib/api/credits"
import { useTenant } from "@/lib/contexts/tenant-context"

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

const DEFAULT_MODE: AiModelMode = "PREMIUM"
const DEFAULT_MODEL_ID = "gpt-5.6-sol"
const STORAGE_KEY = "ai_model_preference"
const STORAGE_VERSION_KEY = "ai_model_preference_v"
const CURRENT_PREF_VERSION = 3

/** Legacy IDs remapped to the GPT-5.6 hierarchy. */
const LEGACY_MODEL_ALIASES: Record<string, string> = {
  "gpt-5.5": "gpt-5.6-terra",
  "gpt-5.5-pro": "gpt-5.6-sol",
  "gpt-4.1": "gpt-5.6-terra",
  "gpt-4o": "gpt-5.6-terra",
  "claude-haiku-4-5": "gpt-5.4-mini",
  "claude-sonnet-4-6": "gpt-5.6-luna",
  "claude-opus-4-8": "gpt-5.6-sol",
  "claude-opus-4-6": "gpt-5.6-sol",
  "claude-fable-5": "gpt-5.6-sol",
}

const DEFAULT_MODELS: AiPremiumModel[] = [
  { modelId: "gpt-5.6-sol", label: "GPT-5.6 Sol" },
  { modelId: "gpt-5.6-terra", label: "GPT-5.6 Terra" },
  { modelId: "gpt-5.6-luna", label: "GPT-5.6 Luna" },
]

interface StoredPreference {
  mode: AiModelMode
  modelId: string
}

function prefVersion(): number {
  if (typeof window === "undefined") return CURRENT_PREF_VERSION
  return Number(localStorage.getItem(STORAGE_VERSION_KEY) ?? "1")
}

function writePrefVersion() {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(STORAGE_VERSION_KEY, String(CURRENT_PREF_VERSION))
  } catch {
    // ignore
  }
}

function remapModelId(modelId: string, available?: AiPremiumModel[]): string {
  const next = LEGACY_MODEL_ALIASES[modelId] ?? modelId
  if (available && available.length > 0 && !available.some((m) => m.modelId === next)) {
    return available[0]?.modelId ?? DEFAULT_MODEL_ID
  }
  return next
}

function readLocalPreference(): StoredPreference | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredPreference
    return {
      mode: parsed.mode,
      modelId: remapModelId(parsed.modelId),
    }
  } catch {
    return null
  }
}

function writeLocalPreference(mode: AiModelMode, modelId: string) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode, modelId }))
  } catch {
    // ignore quota errors
  }
}

interface AiModelContextValue {
  mode: AiModelMode
  modelId: string
  setAiModel: (mode: AiModelMode, modelId: string) => void
  isSaving: boolean
  /** Full list of available premium models — populated from the wallet on mount. */
  availableModels: AiPremiumModel[]
  /** Wallet usage metrics for display in the picker. */
  walletMeta: AiWalletMeta | null
}

const AiModelContext = createContext<AiModelContextValue>({
  mode: DEFAULT_MODE,
  modelId: DEFAULT_MODEL_ID,
  setAiModel: () => {},
  isSaving: false,
  availableModels: DEFAULT_MODELS,
  walletMeta: null,
})

export function AiModelProvider({ children }: { children: React.ReactNode }) {
  const { activeTenantId } = useTenant()
  const queryClient = useQueryClient()

  // Initialise from localStorage immediately — avoids a PREMIUM flash on navigation.
  const localPref = useMemo(() => readLocalPreference(), [])
  const [mode, setMode] = useState<AiModelMode>(localPref?.mode ?? DEFAULT_MODE)
  const [modelId, setModelId] = useState(localPref?.modelId ?? DEFAULT_MODEL_ID)
  const [isSaving, setIsSaving] = useState(false)
  const [availableModels, setAvailableModels] = useState<AiPremiumModel[]>(DEFAULT_MODELS)
  const [walletMeta, setWalletMeta] = useState<AiWalletMeta | null>(null)

  // Track which tenantId was used for the last hydration (undefined = never run).
  const hydratedForTenant = useRef<string | null | undefined>(undefined)

  // Re-hydrate whenever activeTenantId changes (covers the null → tenantId race).
  useEffect(() => {
    if (hydratedForTenant.current === activeTenantId) return
    hydratedForTenant.current = activeTenantId
    getCreditWallet(activeTenantId ?? undefined)
      .then((res) => {
        const wallet = res.wallet

        const models =
          wallet.availablePremiumModels && wallet.availablePremiumModels.length > 0
            ? wallet.availablePremiumModels.map((m) => ({
                modelId: m.modelId,
                label: m.label,
                costTier: (m as Record<string, unknown>).costTier as string | undefined,
                estimatedCreditsTypical: m.estimatedCreditsTypical,
              }))
            : DEFAULT_MODELS

        setAvailableModels(models)

        const serverMode: AiModelMode = wallet.aiModelMode ?? DEFAULT_MODE
        const serverModelId = remapModelId(
          wallet.premiumModelId ?? DEFAULT_MODEL_ID,
          models,
        )
        setMode(serverMode)
        setModelId(serverModelId)
        writeLocalPreference(serverMode, serverModelId)
        writePrefVersion()

        // Persist one-time Sonnet→Sol migrate so wallet/API stay in sync.
        if (serverModelId !== (wallet.premiumModelId ?? DEFAULT_MODEL_ID)) {
          updateAiPreferences(
            { aiModelMode: serverMode, premiumModelId: serverModelId },
            activeTenantId ?? undefined,
          ).catch(() => {/* best-effort */})
        }

        setWalletMeta({
          creditsRemaining: wallet.creditsRemaining ?? 0,
          autoPercentUsed: wallet._internal?.autoPercentUsed ?? wallet.percentUsed ?? 0,
          premiumPercentUsed: wallet._internal?.premiumPercentUsed ?? wallet.percentUsed ?? 0,
          autoModelName: wallet.autoModelName,
        })
      })
      .catch(() => {
        // Keep the local/default values on error.
      })
  }, [activeTenantId])

  const setAiModel = useCallback(
    (newMode: AiModelMode, newModelId: string) => {
      setMode(newMode)
      setModelId(newModelId)
      writeLocalPreference(newMode, newModelId)
      setIsSaving(true)
      updateAiPreferences(
        { aiModelMode: newMode, premiumModelId: newModelId },
        activeTenantId ?? undefined,
      )
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ["credit-wallet"] })
          queryClient.invalidateQueries({ queryKey: ["plan-usage"] })
          queryClient.invalidateQueries({ queryKey: ["credit-wallet-meter"] })
        })
        .catch(() => {/* best-effort */})
        .finally(() => setIsSaving(false))
    },
    [activeTenantId, queryClient],
  )

  const value = useMemo(
    () => ({ mode, modelId, setAiModel, isSaving, availableModels, walletMeta }),
    [mode, modelId, setAiModel, isSaving, availableModels, walletMeta],
  )

  return <AiModelContext.Provider value={value}>{children}</AiModelContext.Provider>
}

/** Returns the global AI model preference and a setter that persists everywhere. */
export function useAiModel(): AiModelContextValue {
  return useContext(AiModelContext)
}
