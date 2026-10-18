"use client"

import { useEffect, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { ChevronDown, ChevronUp, Lightbulb, PlayCircle, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTourOptional } from "@/lib/contexts/tour-context"
import { cn } from "@/lib/utils"

/** Compact help panel shown after a page tour is complete, or when opened from Help */
export function PageHelpPanel() {
  const t = useTranslations("tutorials")
  const tour = useTourOptional()
  const panelRef = useRef<HTMLDivElement>(null)
  const [collapsed, setCollapsed] = useState(false)

  const currentTourId = tour?.currentTourId
  const helpPanelTourId = tour?.helpPanelTourId

  useEffect(() => {
    if (!tour || !currentTourId || helpPanelTourId !== currentTourId) return
    panelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
  }, [currentTourId, helpPanelTourId, tour])

  if (!tour?.currentTour?.helpPanel || !currentTourId) return null

  const {
    currentTour,
    isHelpPanelDismissed,
    isTourCompleted,
    dismissHelpPanel,
    replayCurrentTour,
    closeHelpPanel,
  } = tour

  const showPanel =
    !isHelpPanelDismissed(currentTourId) &&
    (isTourCompleted(currentTourId) || helpPanelTourId === currentTourId)

  if (!showPanel) return null

  const panel = currentTour!.helpPanel!

  const handleDismiss = () => {
    dismissHelpPanel(currentTourId)
    closeHelpPanel()
  }

  return (
    <div
      ref={panelRef}
      className={cn(
        "mb-5 overflow-hidden rounded-xl border border-primary/20 bg-primary/[0.04] motion-tab-enter",
        collapsed && "pb-0",
      )}
      data-tour="page-help-panel"
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/15">
            <Lightbulb className="h-3.5 w-3.5 text-primary" />
          </div>
          <p className="text-sm font-medium text-foreground truncate">{t(panel.titleKey)}</p>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground hidden sm:inline-flex"
            onClick={replayCurrentTour}
          >
            <PlayCircle className="mr-1.5 h-3.5 w-3.5" />
            {t("help.replayTour")}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            aria-label={collapsed ? t("help.openTips") : t("help.hideTips")}
            onClick={() => setCollapsed((value) => !value)}
          >
            {collapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            aria-label={t("help.dismiss")}
            onClick={handleDismiss}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {!collapsed ? (
        <div className="space-y-3 border-t border-primary/10 px-4 pb-3 pt-2">
          <ul className="space-y-1.5">
            {panel.bullets.map((key) => (
              <li key={key} className="flex items-start gap-2 text-[13px] text-muted-foreground leading-snug">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary/60" />
                <span>{t(key)}</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-3 sm:hidden">
            <Button variant="outline" size="sm" onClick={replayCurrentTour} className="h-7 gap-1.5 text-xs">
              <PlayCircle className="h-3.5 w-3.5" />
              {t("help.replayTour")}
            </Button>
            <button
              type="button"
              className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
              onClick={handleDismiss}
            >
              {t("help.hideTips")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
