"use client"

import { useMemo } from "react"
import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import {
  BookOpen,
  HelpCircle,
  Lightbulb,
  Map,
  PlayCircle,
} from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { useTourOptional } from "@/lib/contexts/tour-context"
import { getAllToursForZone, SHELL_TOUR } from "@/lib/tutorials/tour-registry"

interface HelpSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function HelpSheet({ open, onOpenChange }: HelpSheetProps) {
  const t = useTranslations("tutorials")
  const pathname = usePathname()
  const tour = useTourOptional()

  const isLawyerApp = pathname.startsWith("/app")

  const { completedCount, totalCount, progressPercent } = useMemo(() => {
    if (!tour) return { completedCount: 0, totalCount: 0, progressPercent: 0 }
    const all = getAllToursForZone(tour.zone)
    const completed = all.filter((item) => tour.isTourCompleted(item.id)).length
    const total = all.length
    return {
      completedCount: completed,
      totalCount: total,
      progressPercent: total > 0 ? Math.round((completed / total) * 100) : 0,
    }
  }, [tour])

  if (!tour) return null

  const { currentTour, replayCurrentTour, openHelpPanel, startTour } = tour
  const panel = currentTour?.helpPanel

  const handleOpenTips = () => {
    openHelpPanel()
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="text-left space-y-1 pb-4 border-b">
          <div className="flex items-center gap-2 text-primary">
            <HelpCircle className="h-5 w-5" />
            <SheetTitle>{t("help.sheetTitle")}</SheetTitle>
          </div>
          <SheetDescription>{t("help.progress", { completed: completedCount, total: totalCount })}</SheetDescription>
        </SheetHeader>

        <div className="py-4 space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Map className="h-3.5 w-3.5" />
                {t("help.progress", { completed: completedCount, total: totalCount })}
              </span>
              <span>{progressPercent}%</span>
            </div>
            <Progress value={progressPercent} className="h-2" />
          </div>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              {t("help.thisPage")}
            </h3>
            {panel ? (
              <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                <p className="text-sm font-medium">{t(panel.titleKey)}</p>
                <ul className="space-y-2">
                  {panel.bullets.map((key) => (
                    <li key={key} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Lightbulb className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                      <span>{t(key)}</span>
                    </li>
                  ))}
                </ul>
                <Button variant="outline" size="sm" className="gap-2" onClick={handleOpenTips}>
                  {t("help.openTips")}
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t("help.noPageTour")}</p>
            )}
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold">{t("help.actions")}</h3>
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                className="justify-start gap-2"
                onClick={() => {
                  replayCurrentTour()
                  onOpenChange(false)
                }}
                disabled={!currentTour}
              >
                <PlayCircle className="h-4 w-4" />
                {t("help.replayTour")}
              </Button>
              {isLawyerApp ? (
                <Button
                  variant="outline"
                  className="justify-start gap-2"
                  onClick={() => {
                    startTour(SHELL_TOUR.id, { force: true })
                    onOpenChange(false)
                  }}
                >
                  <PlayCircle className="h-4 w-4" />
                  {t("help.replayShell")}
                </Button>
              ) : null}
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  )
}
