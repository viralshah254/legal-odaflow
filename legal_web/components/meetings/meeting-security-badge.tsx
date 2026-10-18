"use client"

import { Badge } from "@/components/ui/badge"
import type { ConfidentialityLevel } from "@/lib/types/meetings"
import { cn } from "@/lib/utils"
import { Shield, ShieldAlert, ShieldCheck } from "lucide-react"

const levelConfig: Record<
  ConfidentialityLevel,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ElementType }
> = {
  standard: { label: "Standard", variant: "outline", icon: Shield },
  restricted: { label: "Restricted", variant: "secondary", icon: ShieldAlert },
  highly_restricted: { label: "Highly restricted", variant: "destructive", icon: ShieldCheck },
}

export function MeetingSecurityBadge({
  level,
  className,
}: {
  level: ConfidentialityLevel
  className?: string
}) {
  const config = levelConfig[level]
  const Icon = config.icon
  return (
    <Badge variant={config.variant} className={cn("gap-1 font-normal", className)}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  )
}
