"use client"

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
  label = "Ask Copilot",
}: OpenCopilotButtonProps) {
  const setCopilotDrawerOpen = useUIStore((state) => state.setCopilotDrawerOpen)
  const { canUseCopilot } = useCopilotContext()

  if (!canUseCopilot) return null

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={() => setCopilotDrawerOpen(true)}
      title="Open Copilot (Shift+Cmd+K)"
    >
      <Sparkles className="h-4 w-4 mr-2" />
      {label}
    </Button>
  )
}
