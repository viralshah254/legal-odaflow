"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { HelpCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { HelpSheet } from "@/components/tutorials/help-sheet"
import { useTourOptional } from "@/lib/contexts/tour-context"
import { cn } from "@/lib/utils"

interface TourHelpTriggerProps {
  className?: string
  variant?: "icon" | "ghost"
}

export function TourHelpTrigger({ className, variant = "icon" }: TourHelpTriggerProps) {
  const t = useTranslations("tutorials")
  const tour = useTourOptional()
  const [open, setOpen] = useState(false)

  if (!tour) return null

  if (variant === "ghost") {
    return (
      <>
        <Button
          variant="ghost"
          className={cn("h-9 gap-2", className)}
          onClick={() => setOpen(true)}
        >
          <HelpCircle className="h-4 w-4" />
          <span className="hidden sm:inline">{t("help.pageHelp")}</span>
        </Button>
        <HelpSheet open={open} onOpenChange={setOpen} />
      </>
    )
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className={cn("shrink-0", className)}
        title={t("help.sheetTitle")}
        onClick={() => setOpen(true)}
      >
        <HelpCircle className="h-5 w-5" />
      </Button>
      <HelpSheet open={open} onOpenChange={setOpen} />
    </>
  )
}
