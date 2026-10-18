"use client"

import { useCallback, useEffect, useState } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  ChevronDown,
  Crown,
  Check,
  Plus,
  Loader2,
  Sparkles,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  getUserDraftStyle,
  getDraftStylePresets,
  MY_STYLE_ID,
  type DraftStylePreset,
  type UserDraftStyleState,
} from "@/lib/api/user-draft-style"
import { DraftingStyleSetupDialog } from "@/components/settings/drafting-style-dialog"

const STORAGE_KEY_PREFIX = "umbrella:draft-style:"

function getStoredStyleId(userId?: string): string {
  if (typeof window === "undefined" || !userId) return MY_STYLE_ID
  return localStorage.getItem(`${STORAGE_KEY_PREFIX}${userId}`) ?? MY_STYLE_ID
}

function setStoredStyleId(userId: string, styleId: string) {
  if (typeof window === "undefined") return
  localStorage.setItem(`${STORAGE_KEY_PREFIX}${userId}`, styleId)
}

interface StyleSelectorDropdownProps {
  userId?: string
  /** Called whenever the active styleId changes */
  onStyleChange?: (styleId: string) => void
  className?: string
}

export function StyleSelectorDropdown({
  userId,
  onStyleChange,
  className,
}: StyleSelectorDropdownProps) {
  const [open, setOpen] = useState(false)
  const [setupOpen, setSetupOpen] = useState(false)
  const [userStyle, setUserStyle] = useState<UserDraftStyleState | null>(null)
  const [presets, setPresets] = useState<DraftStylePreset[]>([])
  const [selectedId, setSelectedId] = useState<string>(MY_STYLE_ID)
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [styleData, presetsData] = await Promise.all([
        getUserDraftStyle(),
        getDraftStylePresets(),
      ])
      setUserStyle(styleData)
      setPresets(presetsData)

      // Restore from localStorage — but only select "my_style" by default if it's ready
      const stored = getStoredStyleId(userId)
      const effectiveDefault =
        styleData.status === "ready" ? MY_STYLE_ID : (presetsData[0]?.id ?? MY_STYLE_ID)
      const effective =
        stored === MY_STYLE_ID && styleData.status !== "ready"
          ? effectiveDefault
          : stored
      setSelectedId(effective)
      onStyleChange?.(effective)
    } catch {
      // graceful
    } finally {
      setLoading(false)
    }
  }, [userId, onStyleChange])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleSelect = (styleId: string) => {
    // If clicking "my_style" and it's not set up, open setup dialog instead
    if (styleId === MY_STYLE_ID && userStyle?.status !== "ready") {
      setOpen(false)
      setSetupOpen(true)
      return
    }
    setSelectedId(styleId)
    if (userId) setStoredStyleId(userId, styleId)
    onStyleChange?.(styleId)
    setOpen(false)
  }

  const handleStyleReady = () => {
    loadData()
    setSelectedId(MY_STYLE_ID)
    if (userId) setStoredStyleId(userId, MY_STYLE_ID)
    onStyleChange?.(MY_STYLE_ID)
  }

  const getSelectedLabel = () => {
    if (selectedId === MY_STYLE_ID) {
      return userStyle?.status === "ready" ? "My Style" : "Style"
    }
    return presets.find((p) => p.id === selectedId)?.label ?? "Style"
  }

  if (loading) {
    return (
      <div className={cn("flex items-center gap-1.5 text-xs text-muted-foreground", className)}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span>Style</span>
      </div>
    )
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-7 gap-1.5 text-xs font-normal px-2.5 border border-transparent hover:border-border",
              className,
            )}
          >
            {selectedId === MY_STYLE_ID && userStyle?.status === "ready" ? (
              <Crown className="h-3.5 w-3.5 text-amber-500" />
            ) : (
              <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            <span>{getSelectedLabel()}</span>
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-64 p-1" align="start">
          {/* My Style option — always first */}
          <StyleOption
            id={MY_STYLE_ID}
            label={
              userStyle?.status === "ready"
                ? "My Style"
                : "My Style"
            }
            description={
              userStyle?.status === "ready"
                ? "Your personal drafting style"
                : "Set up your personal style"
            }
            isSelected={selectedId === MY_STYLE_ID && userStyle?.status === "ready"}
            isPersonal
            isReady={userStyle?.status === "ready"}
            onSelect={() => handleSelect(MY_STYLE_ID)}
          />

          {/* Divider */}
          <div className="my-1 px-2">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-medium pt-1">
              Umbrella Style Library
            </div>
          </div>

          {/* Presets */}
          {presets.map((preset) => (
            <StyleOption
              key={preset.id}
              id={preset.id}
              label={preset.label}
              description={preset.description}
              isSelected={selectedId === preset.id}
              onSelect={() => handleSelect(preset.id)}
            />
          ))}
        </PopoverContent>
      </Popover>

      <DraftingStyleSetupDialog
        open={setupOpen}
        onOpenChange={setSetupOpen}
        onStyleReady={handleStyleReady}
      />
    </>
  )
}

interface StyleOptionProps {
  id: string
  label: string
  description: string
  isSelected: boolean
  isPersonal?: boolean
  isReady?: boolean
  onSelect: () => void
}

function StyleOption({
  label,
  description,
  isSelected,
  isPersonal,
  isReady,
  onSelect,
}: StyleOptionProps) {
  return (
    <button
      className={cn(
        "w-full flex items-start gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors",
        "hover:bg-muted/60",
        isSelected && "bg-muted",
      )}
      onClick={onSelect}
    >
      <div className="flex-shrink-0 mt-0.5">
        {isPersonal ? (
          <Crown
            className={cn(
              "h-4 w-4",
              isReady ? "text-amber-500" : "text-muted-foreground/40",
            )}
          />
        ) : (
          <Sparkles className="h-4 w-4 text-muted-foreground/50" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-medium truncate">{label}</span>
          {isPersonal && !isReady && (
            <Badge variant="outline" className="text-[9px] py-0 px-1 h-4 gap-0.5 border-primary/40 text-primary">
              <Plus className="h-2.5 w-2.5" />
              Add
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate mt-0.5">{description}</p>
      </div>
      {isSelected && (
        <Check className="h-3.5 w-3.5 text-primary flex-shrink-0 mt-0.5" />
      )}
    </button>
  )
}
