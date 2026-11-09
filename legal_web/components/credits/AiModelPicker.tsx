"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { Check, ChevronDown, Crown, Loader2, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { useAiModel } from "@/lib/contexts/ai-model-context"

function tierLabel(tier: string | undefined): string {
  switch (tier) {
    case "fast": return "Fast"
    case "standard": return "Standard"
    case "heavy": return "Heavy"
    case "ultra": return "Ultra"
    default: return tier ?? ""
  }
}

function tierBadgeClass(tier: string | undefined): string {
  switch (tier) {
    case "fast": return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
    case "standard": return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
    case "heavy": return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
    case "ultra": return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
    default: return "bg-muted text-muted-foreground"
  }
}

interface AiModelPickerProps {
  /** Called after the preference is saved so the parent can reflect the new values */
  onChange?: (mode: "AUTO" | "PREMIUM", premiumModelId: string) => void
  className?: string
  /** Compact layout — hides the usage bars */
  compact?: boolean
  /** Workflow stages can route above the wallet default. */
  stageRouting?: boolean
}

export function AiModelPicker({ onChange, className, compact = false, stageRouting = false }: AiModelPickerProps) {
  const tProgress = useTranslations("marketing.home.researchProgress")
  const {
    mode: modelMode,
    modelId: premiumModelId,
    setAiModel,
    isSaving,
    availableModels,
    walletMeta,
  } = useAiModel()

  const [dropdownOpen, setDropdownOpen] = useState(false)

  // Ensure the stored modelId is valid against the available list.
  const resolvedModelId = availableModels.some((m) => m.modelId === premiumModelId)
    ? premiumModelId
    : availableModels[0]?.modelId ?? premiumModelId

  // When the server list doesn't include the stored model, sync context so every API call agrees.
  useEffect(() => {
    if (availableModels.length > 0 && resolvedModelId !== premiumModelId) {
      setAiModel(modelMode, resolvedModelId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedModelId])

  function handleModeChange(mode: "AUTO" | "PREMIUM") {
    setAiModel(mode, resolvedModelId)
    onChange?.(mode, resolvedModelId)
  }

  function handleModelSelect(modelId: string) {
    setDropdownOpen(false)
    setAiModel(modelMode, modelId)
    onChange?.(modelMode, modelId)
  }

  const activeModel = availableModels.find((m) => m.modelId === resolvedModelId) ?? availableModels[0]

  return (
    <div className={cn("space-y-3", className)}>
      {/* Usage meters */}
      {!compact && walletMeta && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5 min-w-0">
            <Zap className="h-3 w-3 text-blue-500 shrink-0" />
            <span className="truncate">Auto {walletMeta.autoPercentUsed}%</span>
          </div>
          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all"
              style={{ width: `${walletMeta.autoPercentUsed}%` }}
            />
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            <Crown className="h-3 w-3 text-amber-500 shrink-0" />
            <span className="truncate">Premium {walletMeta.premiumPercentUsed}%</span>
          </div>
        </div>
      )}

      {/* Mode toggle */}
      <div className="flex gap-1.5 items-center">
        <Button
          type="button"
          variant={modelMode === "AUTO" ? "default" : "outline"}
          size="sm"
          className="gap-1.5 h-8 text-xs"
          onClick={() => handleModeChange("AUTO")}
          disabled={isSaving}
        >
          <Zap className="h-3 w-3" />
          Auto
        </Button>
        <Button
          type="button"
          variant={modelMode === "PREMIUM" ? "default" : "outline"}
          size="sm"
          className="gap-1.5 h-8 text-xs"
          onClick={() => handleModeChange("PREMIUM")}
          disabled={isSaving}
        >
          <Crown className="h-3 w-3" />
          Premium
        </Button>
        {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      </div>

      {/* Premium model selector — Radix portal avoids overflow-hidden clip on parent cards */}
      {modelMode === "PREMIUM" && (
        <div className="relative">
          <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
            <DropdownMenuTrigger asChild disabled={isSaving}>
              <button
                type="button"
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors hover:bg-muted/40 focus:outline-none focus:ring-1 focus:ring-ring",
                  dropdownOpen && "ring-1 ring-ring",
                )}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span className="truncate font-medium">{activeModel?.label ?? resolvedModelId}</span>
                  {activeModel?.costTier && (
                    <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold", tierBadgeClass(activeModel.costTier))}>
                      {tierLabel(activeModel.costTier)}
                    </span>
                  )}
                </span>
                <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", dropdownOpen && "rotate-180")} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              sideOffset={4}
              className="w-[var(--radix-dropdown-menu-trigger-width)] max-h-60 overflow-y-auto p-0"
            >
              {availableModels.map((m) => {
                const isSelected = m.modelId === resolvedModelId
                return (
                  <DropdownMenuItem
                    key={m.modelId}
                    onSelect={() => handleModelSelect(m.modelId)}
                    className={cn(
                      "flex cursor-pointer items-center justify-between gap-3 rounded-none px-3 py-2.5",
                      isSelected && "bg-primary/5",
                    )}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span className={cn("h-4 w-4 shrink-0", isSelected ? "text-primary" : "text-transparent")}>
                        <Check className="h-4 w-4" />
                      </span>
                      <span className={cn("truncate", isSelected && "font-medium")}>{m.label}</span>
                    </span>
                    {m.costTier && (
                      <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold", tierBadgeClass(m.costTier))}>
                        {tierLabel(m.costTier)}
                      </span>
                    )}
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {modelMode === "AUTO" && (
        <p className="text-xs text-muted-foreground">
          Auto selects the best-value model for each task.
          {stageRouting ? tProgress("modelRoutingNote") : walletMeta?.autoModelName ? ` Default: ${walletMeta.autoModelName}.` : ""}
        </p>
      )}
    </div>
  )
}
