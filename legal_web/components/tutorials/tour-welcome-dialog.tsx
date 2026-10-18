"use client"

import { useTranslations } from "next-intl"
import { Sparkles, CheckCircle2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useTour } from "@/lib/contexts/tour-context"

interface TourWelcomeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TourWelcomeDialog({ open, onOpenChange }: TourWelcomeDialogProps) {
  const t = useTranslations("tutorials")
  const { startWelcomeTour, skipWelcomeTour } = useTour()

  const bullets = ["welcome.b1", "welcome.b2", "welcome.b3"] as const

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden gap-0">
        <div className="h-1.5 w-full bg-gradient-to-r from-primary via-primary/80 to-primary/40" />
        <div className="p-6 space-y-4">
          <DialogHeader className="space-y-3 text-left">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <DialogTitle className="text-xl">{t("welcome.title")}</DialogTitle>
            <DialogDescription className="text-sm leading-relaxed">
              {t("welcome.body")}
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-2.5">
            {bullets.map((key) => (
              <li key={key} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>{t(key)}</span>
              </li>
            ))}
          </ul>
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-2 pt-2">
            <Button variant="ghost" className="sm:flex-1" onClick={skipWelcomeTour}>
              {t("welcome.skip")}
            </Button>
            <Button className="sm:flex-1" onClick={startWelcomeTour}>
              {t("welcome.start")}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
