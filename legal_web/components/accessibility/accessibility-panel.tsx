"use client"

import type { ComponentType } from "react"
import { useTranslations } from "next-intl"
import {
  Accessibility,
  AlignLeft,
  BookOpen,
  Contrast,
  Eye,
  EyeOff,
  GripHorizontal,
  ImageOff,
  Info,
  Layers,
  Link2,
  MousePointer2,
  Pause,
  RotateCcw,
  Sparkles,
  Type,
  Volume2,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { useAccessibilityStore } from "@/lib/accessibility/accessibility-store"
import type { AccessibilityProfileId } from "@/lib/accessibility/types"

interface AccessibilityPanelProps {
  onClose: () => void
  onHideWidget: () => void
}

const PROFILE_IDS: AccessibilityProfileId[] = [
  "motorImpaired",
  "blind",
  "colorBlind",
  "dyslexia",
  "lowVision",
  "cognitive",
  "seizure",
  "adhd",
]

export function AccessibilityPanel({ onClose, onHideWidget }: AccessibilityPanelProps) {
  const t = useTranslations("accessibility")
  const settings = useAccessibilityStore((s) => s.settings)
  const toggleProfile = useAccessibilityStore((s) => s.toggleProfile)
  const updateSetting = useAccessibilityStore((s) => s.updateSetting)
  const cycleTextScale = useAccessibilityStore((s) => s.cycleTextScale)
  const cycleLineHeight = useAccessibilityStore((s) => s.cycleLineHeight)
  const cycleSaturation = useAccessibilityStore((s) => s.cycleSaturation)
  const cycleTextAlign = useAccessibilityStore((s) => s.cycleTextAlign)
  const resetAll = useAccessibilityStore((s) => s.resetAll)

  const textScaleLabel =
    settings.textScale === 0
      ? t("off")
      : t("level", { n: settings.textScale })
  const lineHeightLabel =
    settings.lineHeight === 0
      ? t("off")
      : t("level", { n: settings.lineHeight })
  const saturationLabel = t(`saturation_${settings.saturation}`)
  const textAlignLabel =
    settings.textAlign === "default"
      ? t("off")
      : t(`textAlign_${settings.textAlign}`)

  return (
    <div
      className="a11y-panel w-[min(calc(100vw-24px),22rem)] max-h-[calc(100dvh-24px)] flex flex-col rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl"
      role="dialog"
      aria-modal="false"
      aria-label={t("menuTitle")}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <Accessibility className="h-5 w-5 shrink-0 text-primary" aria-hidden />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold truncate">{t("menuTitle")}</h2>
            <p className="text-[10px] text-muted-foreground">{t("shortcutHint")}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={onClose}
          aria-label={t("close")}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1 max-h-[min(calc(100dvh-12rem),32rem)]">
        <div className="p-4 space-y-4">
          <section aria-labelledby="a11y-profiles-heading">
            <h3 id="a11y-profiles-heading" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              {t("profilesHeading")}
            </h3>
            <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label={t("profilesHeading")}>
              {PROFILE_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={settings.activeProfile === id}
                  className={cn(
                    "text-left text-xs px-2.5 py-2 rounded-lg border transition-colors",
                    settings.activeProfile === id
                      ? "border-primary bg-primary/10 text-foreground font-medium"
                      : "border-border hover:bg-accent/50",
                  )}
                  onClick={() => toggleProfile(id)}
                >
                  {t(`profile_${id}`)}
                </button>
              ))}
            </div>
          </section>

          <Separator />

          <section aria-labelledby="a11y-tools-heading">
            <h3 id="a11y-tools-heading" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              {t("toolsHeading")}
            </h3>
            <div className="space-y-1">
              <ToolToggle
                icon={Accessibility}
                label={t("oversizedWidget")}
                checked={settings.oversizedWidget}
                onCheckedChange={(v) => updateSetting("oversizedWidget", v)}
              />
              <ToolToggle
                icon={Sparkles}
                label={t("smartContrast")}
                checked={settings.smartContrast}
                onCheckedChange={(v) => updateSetting("smartContrast", v)}
              />
              <ToolToggle
                icon={Pause}
                label={t("pauseAnimations")}
                checked={settings.pauseAnimations}
                onCheckedChange={(v) => updateSetting("pauseAnimations", v)}
              />
              <ToolToggle
                icon={Volume2}
                label={t("screenReader")}
                checked={settings.screenReaderEnhancements}
                onCheckedChange={(v) => updateSetting("screenReaderEnhancements", v)}
              />
              <ToolToggle
                icon={Contrast}
                label={t("contrastPlus")}
                checked={settings.highContrast}
                onCheckedChange={(v) => updateSetting("highContrast", v)}
              />
              <ToolToggle
                icon={Link2}
                label={t("highlightLinks")}
                checked={settings.highlightLinks}
                onCheckedChange={(v) => updateSetting("highlightLinks", v)}
              />
              <ToolStep
                icon={Type}
                label={t("biggerText")}
                value={textScaleLabel}
                onClick={cycleTextScale}
              />
              <ToolToggle
                icon={Type}
                label={t("textSpacing")}
                checked={settings.textSpacing}
                onCheckedChange={(v) => updateSetting("textSpacing", v)}
              />
              <ToolToggle
                icon={ImageOff}
                label={t("hideImages")}
                checked={settings.hideImages}
                onCheckedChange={(v) => updateSetting("hideImages", v)}
              />
              <ToolToggle
                icon={BookOpen}
                label={t("dyslexiaFriendly")}
                checked={settings.dyslexiaFont}
                onCheckedChange={(v) => updateSetting("dyslexiaFont", v)}
              />
              <ToolToggle
                icon={MousePointer2}
                label={t("cursor")}
                checked={settings.largeCursor}
                onCheckedChange={(v) => updateSetting("largeCursor", v)}
              />
              <ToolToggle
                icon={Info}
                label={t("tooltips")}
                checked={settings.tooltips}
                onCheckedChange={(v) => updateSetting("tooltips", v)}
              />
              <ToolToggle
                icon={Layers}
                label={t("pageStructure")}
                checked={settings.pageStructure}
                onCheckedChange={(v) => updateSetting("pageStructure", v)}
              />
              <ToolStep
                icon={Type}
                label={t("lineHeight")}
                value={lineHeightLabel}
                onClick={cycleLineHeight}
              />
              <ToolStep
                icon={AlignLeft}
                label={t("textAlign")}
                value={textAlignLabel}
                onClick={cycleTextAlign}
              />
              <ToolToggle
                icon={BookOpen}
                label={t("dictionary")}
                checked={settings.dictionary}
                onCheckedChange={(v) => updateSetting("dictionary", v)}
              />
              <ToolStep
                icon={Eye}
                label={t("saturation")}
                value={saturationLabel}
                onClick={cycleSaturation}
              />
            </div>
          </section>
        </div>
      </ScrollArea>

      <div className="border-t border-border p-3 flex flex-col gap-2">
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2"
          onClick={() => {
            resetAll()
            onClose()
          }}
        >
          <RotateCcw className="h-4 w-4" aria-hidden />
          {t("resetAll")}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-muted-foreground"
          onClick={onHideWidget}
        >
          <EyeOff className="h-4 w-4" aria-hidden />
          {t("moveHideWidget")}
        </Button>
        <p className="text-[10px] text-muted-foreground flex items-center gap-1 px-1">
          <GripHorizontal className="h-3 w-3" aria-hidden />
          {t("dragHint")}
        </p>
      </div>
    </div>
  )
}

function ToolToggle({
  icon: Icon,
  label,
  checked,
  onCheckedChange,
}: {
  icon: ComponentType<{ className?: string }>
  label: string
  checked: boolean
  onCheckedChange: (v: boolean) => void
}) {
  const id = label.replace(/\s+/g, "-").toLowerCase()
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-accent/40">
      <label htmlFor={id} className="flex items-center gap-2 text-xs cursor-pointer flex-1 min-w-0">
        <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <span className="truncate">{label}</span>
      </label>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-label={label}
      />
    </div>
  )
}

function ToolStep({
  icon: Icon,
  label,
  value,
  onClick,
}: {
  icon: ComponentType<{ className?: string }>
  label: string
  value: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-accent/40 text-left"
      onClick={onClick}
      aria-label={`${label}: ${value}`}
    >
      <span className="flex items-center gap-2 text-xs min-w-0">
        <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <span className="truncate">{label}</span>
      </span>
      <span className="text-[10px] font-medium text-primary shrink-0">{value}</span>
    </button>
  )
}
