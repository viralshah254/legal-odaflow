"use client"

import { AlertTriangle, Shield, ShieldAlert, ShieldCheck } from "lucide-react"
import { cn } from "@/lib/utils"

type RiskLevel = 'low' | 'medium' | 'high' | 'critical'

interface RiskBadgeProps {
  level: RiskLevel
  showIcon?: boolean
  className?: string
}

const config: Record<RiskLevel, { label: string; icon: React.ElementType; classes: string }> = {
  low: {
    label: 'Low Risk',
    icon: ShieldCheck,
    classes: 'bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
  },
  medium: {
    label: 'Medium Risk',
    icon: Shield,
    classes: 'bg-yellow-500/10 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400',
  },
  high: {
    label: 'High Risk',
    icon: AlertTriangle,
    classes: 'bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  },
  critical: {
    label: 'Critical Risk',
    icon: ShieldAlert,
    classes: 'bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-red-400',
  },
}

export function RiskBadge({ level, showIcon = true, className }: RiskBadgeProps) {
  const { label, icon: Icon, classes } = config[level]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        classes,
        className,
      )}
    >
      {showIcon && <Icon className="h-3.5 w-3.5" />}
      {label}
    </span>
  )
}
