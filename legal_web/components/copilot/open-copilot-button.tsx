"use client"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import { Sparkles } from "lucide-react"
import { useUIStore } from "@/lib/store"
import { useCopilotContext } from "@/lib/contexts/copilot-context"

interface OpenCopilotButtonProps {
  variant?: "default" | "outline" | "ghost" | "secondary" | "link" | "destructive"
  size?: "default" | "sm" | "lg" | "icon"
  className?: string
  label?: string
}

export function OpenCopilotButton({
  variant = "outline",
  size = "sm",
  className,
  label,
}: OpenCopilotButtonProps) {
  const t = useTranslations("copilot")
  const tCommon = useTranslations("common")
  const setCopilotDrawerOpen = useUIStore((state) => state.setCopilotDrawerOpen)
  const { canOpenCopilot } = useCopilotContext()

  if (!canOpenCopilot) return null

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={() => setCopilotDrawerOpen(true)}
      title={tCommon("open_copilot_shiftcmdk")}
    >
      <Sparkles className="h-4 w-4 mr-2" />
      {label ?? t("askCopilot")}
    </Button>
  )
}
